#!/usr/bin/env node
/**
 * Narration is generated only on an explicit run. Supply the API key as the first
 * stdin line (preferred), or OPENAI_API_KEY when stdin is a terminal. Never pass a
 * credential as a CLI argument. The key is neither logged nor written to disk.
 *
 * Official schema references checked 2026-09-22:
 * https://developers.openai.com/api/docs/guides/text-to-speech
 * https://developers.openai.com/api/docs/guides/speech-to-text
 *
 * node scripts/generate-video-audio.mjs --plan
 * node scripts/generate-video-audio.mjs --out .artifacts-build/video
 * node scripts/generate-video-audio.mjs --cut verified-aws --evidence path.json
 */
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { createInterface } from "node:readline";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at < 0 ? fallback : args[at + 1];
};
const root = process.cwd();
const out = resolve(option("--out", ".artifacts-build/video"));
const cut = option("--cut", "rehearsal");
const instructions =
  "Speak in a warm, natural, clear conversational voice with a light British English accent. This is a thoughtful founder explaining a useful product, not an advertisement. About 145 words per minute, with short natural pauses between sentences. Read the supplied text verbatim. Do not add greetings, commentary, sound effects or music. Pronounce SecondCrate as second crate, Northstar as north star, and SES as the separate letters S E S. Slightly pause after Eight remain. Let the final sentence land calmly. Use the stock cedar voice, without impersonating any person.";
const titles = [
  "A cancelled order. A second chance.",
  "Release the right stock.",
  "Match the buyers who can use it.",
  "A conversation with firm boundaries.",
  "One lot. Two requests. One stock truth.",
  "Make the value visible.",
  "Show what is actually running.",
  "A useful business, built to prove itself.",
];
const brief = await readFile(resolve("docs/VIDEO_SCRIPT.md"), "utf8");
const section = brief
  .split("## Verbatim script")[1]
  ?.split("## Action storyboard")[0];
if (!section) throw new Error("Missing verbatim script section.");
const scenes = [
  ...section.matchAll(/^### ([^\n]+)\n+([\s\S]*?)(?=^### |$(?![\s\S]))/gm),
].map((match, index) => ({
  id: String(index + 1).padStart(2, "0"),
  title: titles[index],
  plannedTime: match[1],
  text: match[2].trim().replace(/\n+/g, " "),
}));
if (scenes.length !== 8)
  throw new Error(`Expected eight script scenes, found ${scenes.length}.`);
if (cut === "rehearsal") {
  const replacement = brief
    .split("## Exact rehearsal replacement:")[1]
    ?.split("## Optional verified")[0]
    ?.match(/^> (.+)$/m)?.[1];
  if (!replacement) throw new Error("Missing exact rehearsal paragraph.");
  scenes[6].text = replacement;
} else if (cut === "verified-aws") {
  const path = option("--evidence");
  if (!path)
    throw new Error(
      "Verified narration requires --evidence with actual runtime records.",
    );
  const evidence = JSON.parse(await readFile(resolve(path), "utf8"));
  if (
    evidence.bedrockInvocationSucceeded !== true ||
    evidence.sesMessageAccepted !== true ||
    evidence.operatorReviewedMatchingMessage !== true ||
    !Array.isArray(evidence.files) ||
    evidence.files.length < 2
  )
    throw new Error(
      "Verified narration requires successful Bedrock, matching SES and reviewed source records.",
    );
  for (const file of evidence.files) await access(resolve(file));
} else throw new Error("Use --cut rehearsal or verified-aws.");
for (const scene of scenes) {
  if (scene.text.includes("\u2014"))
    throw new Error(`Scene ${scene.id} contains an em dash.`);
  if (scene.text.length > 4096)
    throw new Error(`Scene ${scene.id} exceeds the speech input limit.`);
}
await mkdir(out, { recursive: true });
await writeFile(
  join(out, "narration-plan.json"),
  JSON.stringify(
    { cut, disclosure: "AI narration: OpenAI cedar", scenes },
    null,
    2,
  ) + "\n",
);
if (args.includes("--plan")) {
  console.log(
    `Prepared ${scenes.length} ${cut} scenes, ${scenes.reduce((sum, scene) => sum + scene.text.split(/\s+/).length, 0)} words. No API calls made.`,
  );
  process.exit(0);
}

let key = process.env.OPENAI_API_KEY?.trim();
if (!process.stdin.isTTY) {
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    if (line.trim()) key = line.trim();
    break;
  }
  input.close();
  process.stdin.destroy();
}
if (!key || !key.startsWith("sk-"))
  throw new Error("Provide an OpenAI API key through stdin or OPENAI_API_KEY.");
delete process.env.OPENAI_API_KEY;

async function request(endpoint, body, json = false) {
  const response = await fetch(`https://api.openai.com/v1/audio/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body: json ? JSON.stringify(body) : body,
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const safeCode = String(error.error?.code || "request_failed")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 80);
    throw new Error(
      `OpenAI ${endpoint} failed: HTTP ${response.status}, ${safeCode}. No credential or response body has been logged.`,
    );
  }
  return response;
}

const audioScenes = [];
for (const scene of scenes) {
  const wavPath = join(out, `scene-${scene.id}.wav`);
  const wordsPath = join(out, `scene-${scene.id}-words.json`);
  const metadataPath = join(out, `scene-${scene.id}-audio.json`);
  const sceneInstructions =
    scene.id === "05"
      ? `${instructions} Ben is a buyer name. Clearly pronounce Ben with a b consonant, rhymes with pen. Keep natural conversational pacing and the exact supplied text.`
      : instructions;
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        text: scene.text,
        instructions: sceneInstructions,
        model: "gpt-4o-mini-tts",
        voice: "cedar",
        speed: 0.97,
      }),
    )
    .digest("hex");
  let cached;
  try {
    cached = JSON.parse(await readFile(metadataPath, "utf8"));
  } catch {}
  if (cached?.digest !== digest) {
    const response = await request(
      "speech",
      {
        model: "gpt-4o-mini-tts",
        voice: "cedar",
        input: scene.text,
        instructions: sceneInstructions,
        response_format: "wav",
        speed: 0.97,
      },
      true,
    );
    const wav = Buffer.from(await response.arrayBuffer());
    if (wav.subarray(0, 4).toString() !== "RIFF")
      throw new Error(`Scene ${scene.id}: speech did not return a WAV file.`);
    await writeFile(wavPath, wav);
    const form = new FormData();
    form.set(
      "file",
      new Blob([wav], { type: "audio/wav" }),
      `scene-${scene.id}.wav`,
    );
    form.set("model", "whisper-1");
    form.set("language", "en");
    form.set("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    form.set("prompt", scene.text);
    const transcription = await (await request("transcriptions", form)).json();
    if (!Array.isArray(transcription.words) || !transcription.words.length)
      throw new Error(
        `Scene ${scene.id}: transcription returned no word timestamps.`,
      );
    await writeFile(wordsPath, JSON.stringify(transcription, null, 2) + "\n");
    await writeFile(
      metadataPath,
      JSON.stringify(
        {
          digest,
          model: "gpt-4o-mini-tts",
          voice: "cedar",
          text: scene.text,
          instructions: sceneInstructions,
          transcriptionModel: "whisper-1",
          disclosure: "AI narration: OpenAI cedar",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`Scene ${scene.id}: narration and word timestamps generated.`);
  } else {
    await access(wavPath);
    await access(wordsPath);
    console.log(`Scene ${scene.id}: unchanged narration reused.`);
  }
  const duration = Number(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        wavPath,
      ],
      { encoding: "utf8" },
    ).trim(),
  );
  if (!Number.isFinite(duration) || duration < 1)
    throw new Error(`Scene ${scene.id}: invalid WAV duration.`);
  audioScenes.push({
    ...scene,
    wav: wavPath,
    words: wordsPath,
    duration,
    digest,
  });
}
key = "";
await writeFile(
  join(out, "audio-manifest.json"),
  JSON.stringify(
    {
      version: 1,
      cut,
      generatedAt: new Date().toISOString(),
      disclosure: "AI narration: OpenAI cedar",
      captionReviewRequired: true,
      scenes: audioScenes,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Audio complete: ${audioScenes.reduce((sum, scene) => sum + scene.duration, 0).toFixed(1)} seconds. Review narration and caption words before publishing.`,
);
