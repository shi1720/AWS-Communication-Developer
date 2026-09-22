#!/usr/bin/env python3
"""Render a disclosed edited walkthrough from actual application captures.

No UI is generated or invented. Pillow renders only branding, captions and the
closing card. FFmpeg encodes the real screenshots, narration and timed captions.
Works without libass/drawtext, including the minimal macOS FFmpeg installation.

Usage:
  python3 scripts/render-demo-video.py --validate
  python3 scripts/render-demo-video.py --frames .artifacts-build/video/frames.json

Copy scripts/video-frames.template.json beside the captures, review each source,
set operatorReviewedScreenshots to true, then run after narration generation.
Use --preview-only for scene contact sheets; no published video is produced.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys
import textwrap

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
WIDTH, HEIGHT, FPS = 1920, 1080, 30
FOREST, CREAM, LIME = "#193C2E", "#F5F4E9", "#D6E8AE"
MUTED, LINE = "#B1C4AF", "#365542"
FONT_DIRS = [Path(os.environ.get("SECONDCRATE_VIDEO_FONTS", "")), Path("/System/Library/Fonts/Supplemental"), Path("/usr/share/fonts/truetype/dejavu")]


def font(size: int, bold: bool = False):
    names = ["Arial Bold.ttf", "DejaVuSans-Bold.ttf"] if bold else ["Arial.ttf", "DejaVuSans.ttf"]
    for directory in FONT_DIRS:
        for name in names:
            if (directory / name).is_file():
                return ImageFont.truetype(str(directory / name), size)
    raise RuntimeError("A readable TrueType font is required. Set SECONDCRATE_VIDEO_FONTS.")


def load_json(path: Path):
    return json.loads(path.read_text())


def current_script(cut: str):
    markdown = (ROOT / "docs/VIDEO_SCRIPT.md").read_text()
    section = markdown.split("## Verbatim script", 1)[1].split("## Action storyboard", 1)[0]
    scenes = [re.sub(r"\s+", " ", text).strip() for text in re.findall(r"^### [^\n]+\n+([\s\S]*?)(?=^### |\Z)", section, re.M)]
    if len(scenes) != 8:
        raise RuntimeError("The current narration source must contain eight scenes.")
    if cut == "rehearsal":
        replacement = markdown.split("## Exact rehearsal replacement:", 1)[1].split("## Optional verified", 1)[0]
        scenes[6] = re.search(r"^> (.+)$", replacement, re.M).group(1)
    return scenes


def run(command: list[str]):
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def duration(path: Path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)], text=True).strip())


def timestamp(value: float, vtt=False):
    ms = round(value * 1000)
    hours, ms = divmod(ms, 3_600_000)
    minutes, ms = divmod(ms, 60_000)
    seconds, ms = divmod(ms, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02}{'.' if vtt else ','}{ms:03}"


def source_aligned_words(words: list[dict], script: str, corrections: list[dict]):
    """Restore script punctuation while retaining the recognizer's real timing.

    A mismatched word must have a specific reviewed correction. Do not silently
    replace a missing sentence, number or claim with the desired source text.
    """
    source = list(re.finditer(r"[A-Za-z0-9]+(?:['’][A-Za-z]+)?", script))
    spoken = []
    for word in words:
        parts = re.findall(r"[A-Za-z0-9]+(?:['’][A-Za-z]+)?", word["word"])
        for index, part in enumerate(parts):
            span = (float(word["end"]) - float(word["start"])) / len(parts)
            spoken.append({"word": part, "start": float(word["start"]) + index * span, "end": float(word["start"]) + (index + 1) * span})
    if len(source) != len(spoken):
        raise RuntimeError("Narration and source word counts differ. Review the audio before captioning.")
    permitted = {(item["index"], item["from"].lower(), item["to"].lower()) for item in corrections}
    result = []
    for index, (expected, actual) in enumerate(zip(source, spoken)):
        original, recognized = expected.group(), actual["word"]
        if original.lower() != recognized.lower() and (index, recognized.lower(), original.lower()) not in permitted:
            raise RuntimeError(f"Caption word {index} differs: recognized {recognized!r}, source {original!r}. Add a reviewed caption correction or regenerate audio.")
        end = source[index + 1].start() if index + 1 < len(source) else len(script)
        punctuation = script[expected.end():end].strip().replace("-", "")
        result.append({**actual, "word": original + punctuation})
    return result


def caption_words(words: list[dict], total: float):
    """Respect real word timestamps, phrase punctuation and two readable lines."""
    captions, group = [], []
    for word in words:
        text = str(word.get("word", "")).strip().replace("\u2014", ",")
        if not text:
            continue
        clean = {"text": text, "start": max(0, float(word["start"])), "end": min(total, float(word["end"]))}
        next_length = len(" ".join(item["text"] for item in group + [clean]))
        if group and (next_length > 72 or clean["end"] - group[0]["start"] > 5.0 or clean["start"] - group[-1]["end"] > 0.75):
            captions.append(group)
            group = []
        group.append(clean)
        if text.endswith((".", "?", "!", ";")) and clean["end"] - group[0]["start"] > 1.2:
            captions.append(group)
            group = []
        elif text.endswith(",") and len(" ".join(item["text"] for item in group)) > 42:
            captions.append(group)
            group = []
    if group:
        captions.append(group)
    # Preserve complete phrases instead of flashing fragments such as "refresh."
    # Their modestly longer two-line cue remains well within the reserved band.
    merged = []
    for group in captions:
        if merged and (len(group) <= 3 or group[-1]["end"] - group[0]["start"] < 1.0) and len(" ".join(item["text"] for item in merged[-1] + group)) <= 110 and group[-1]["end"] - merged[-1][0]["start"] <= 6.0:
            merged[-1].extend(group)
        else:
            merged.append(group)
    captions = merged
    result = []
    for index, group in enumerate(captions):
        text = " ".join(item["text"] for item in group)
        text = text.replace("Second Crate", "SecondCrate").replace("Secondcrate", "SecondCrate")
        # These typographic substitutions preserve the actual spoken prices.
        lines = textwrap.wrap(text, width=40, break_long_words=False, break_on_hyphens=False)
        if len(lines) > 2:
            lines = textwrap.wrap(text, width=math.ceil(len(text) / 2) + 2, break_long_words=False, break_on_hyphens=False)
        end = min(total, group[-1]["end"] + 0.16)
        if index + 1 < len(captions):
            end = min(end, captions[index + 1][0]["start"])
        result.append({"start": group[0]["start"], "end": max(group[0]["start"] + 0.05, end), "text": "\n".join(lines)})
    return result


def header(scene: dict, index: int, cut: str, url_label: str):
    image = Image.new("RGB", (WIDTH, HEIGHT), FOREST)
    draw = ImageDraw.Draw(image)
    draw.text((54, 31), "secondcrate.", font=font(32, True), fill=LIME)
    draw.text((372, 31), scene["title"], font=font(32, True), fill=CREAM)
    draw.line((54, 88, 1866, 88), fill=LINE, width=2)
    tag = "SYNTHETIC DATA  /  SIMULATED MESSAGING" if cut == "rehearsal" else "SYNTHETIC DATA  /  VERIFIED AWS EVIDENCE"
    draw.text((56, 105), tag, font=font(18, True), fill=LIME)
    draw.text((1864, 107), "Edited product walkthrough", font=font(18), fill=MUTED, anchor="ra")
    draw.text((55, 1048), url_label, font=font(17), fill=MUTED, anchor="lm")
    draw.text((1865, 1048), "Created by Shivam Gupta  |  AI narration: OpenAI cedar", font=font(17), fill=MUTED, anchor="rm")
    for step in range(8):
        x = 798 + step * 44
        draw.rounded_rectangle((x, 1041, x + 27, 1048), radius=3, fill=LIME if step <= index else LINE)
    return image


def closing_card():
    image = Image.new("RGB", (1812, 760), CREAM)
    draw = ImageDraw.Draw(image)
    draw.text((85, 67), "EVERY GOOD LOT DESERVES A BUYER.", font=font(22, True), fill=FOREST)
    draw.text((85, 131), "A second destination.", font=font(78, True), fill=FOREST)
    draw.text((85, 228), "A promise you can keep.", font=font(68, True), fill=FOREST)
    draw.rounded_rectangle((85, 361, 685, 589), radius=22, fill=FOREST)
    draw.text((120, 391), "£299", font=font(82, True), fill=LIME)
    draw.text((121, 497), "per depot / month, proposed", font=font(27), fill=CREAM)
    draw.text((780, 384), "Paid pilots are the next step.", font=font(38, True), fill=FOREST)
    draw.text((780, 451), "60 extra crates at £5 contribution", font=font(31), fill=FOREST)
    draw.text((780, 500), "cover the proposed monthly fee.", font=font(31), fill=FOREST)
    draw.text((85, 655), "Created by Shivam Gupta", font=font(27, True), fill=FOREST)
    draw.text((1727, 655), "AI narration: OpenAI cedar", font=font(23), fill=FOREST, anchor="ra")
    return image


def compose_shot(scene: dict, index: int, shot: dict, frames_dir: Path, cut: str, url_label: str):
    image = header(scene, index, cut, url_label)
    if shot.get("card") == "closing":
        source = closing_card()
    else:
        source = Image.open(frames_dir / shot["path"]).convert("RGB")
        if "crop" in shot:
            x, y, w, h = map(int, shot["crop"])
            if min(x, y) < 0 or min(w, h) < 1 or x + w > source.width or y + h > source.height:
                raise ValueError(f"Invalid crop for {shot['path']}")
            source = source.crop((x, y, x + w, y + h))
    # Preserve screenshot aspect ratio and every uncropped pixel. No UI repainting.
    source = ImageOps.contain(source, (1812, 760), Image.Resampling.LANCZOS)
    x, y = (WIDTH - source.width) // 2, 150 + (760 - source.height) // 2
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((x - 4, y - 4, x + source.width + 4, y + source.height + 4), radius=10, fill=LINE)
    image.paste(source, (x, y))
    return image


def caption_overlay(text: str):
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    lines = text.split("\n")
    face = font(40, True)
    for index, line in enumerate(lines):
        draw.text((WIDTH // 2, 944 + index * 47), line, font=face, fill=CREAM, anchor="mm")
    return overlay


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--audio", type=Path, default=ROOT / ".artifacts-build/video/audio-manifest.json")
    parser.add_argument("--frames", type=Path, default=ROOT / ".artifacts-build/video/frames.json")
    parser.add_argument("--output", type=Path, default=ROOT / "deliverables/SecondCrate-Demo.mp4")
    parser.add_argument("--target-seconds", type=float, default=0.0, help="Optional minimum length. Default follows natural narration with a four-second closing hold.")
    parser.add_argument("--caption-corrections", type=Path, default=ROOT / ".artifacts-build/video/caption-corrections.json")
    parser.add_argument("--preview-only", action="store_true")
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError("FFmpeg and ffprobe are required.")
    audio, frames = load_json(args.audio), load_json(args.frames)
    corrections = load_json(args.caption_corrections) if args.caption_corrections.is_file() else {}
    script = current_script(audio["cut"])
    for index, scene in enumerate(audio["scenes"]):
        if re.sub(r"\s+", " ", scene["text"]).strip() != script[index]:
            raise RuntimeError(f"Scene {scene['id']} audio does not match the current approved script. Regenerate that narration before rendering.")
    if frames.get("operatorReviewedScreenshots") is not True:
        raise RuntimeError("Review the actual screenshot provenance and set operatorReviewedScreenshots before rendering.")
    if audio["cut"] != frames["cut"] or frames.get("syntheticData") is not True:
        raise RuntimeError("Audio, scene evidence and synthetic-data disclosure do not match.")
    if len(audio["scenes"]) != 8 or len(frames["scenes"]) != 8:
        raise RuntimeError("The demonstration requires exactly eight audio and frame scenes.")
    frame_scenes = {scene["id"]: scene for scene in frames["scenes"]}
    for scene in audio["scenes"]:
        if not Path(scene["wav"]).is_file() or not Path(scene["words"]).is_file():
            raise RuntimeError(f"Missing scene {scene['id']} narration or word timing.")
        shots = frame_scenes[scene["id"]]["shots"]
        if not shots:
            raise RuntimeError(f"Missing real captures for scene {scene['id']}.")
        for shot in shots:
            if shot.get("card") == "closing" and scene["id"] == "08":
                continue
            if shot.get("source") != "actual-app" or not (args.frames.parent / shot.get("path", "missing")).is_file():
                raise RuntimeError(f"Scene {scene['id']} requires an actual application screenshot: {shot.get('path')}")
    if args.validate:
        print("Eight scenes validated. Real captures and narration are present; no video rendered.")
        return
    build = args.frames.parent / "render"
    build.mkdir(parents=True, exist_ok=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    voice_total = sum(scene["duration"] for scene in audio["scenes"])
    scene_holds = [0.9] * 7 + [4.35]
    extra_hold = max(0, args.target_seconds - voice_total - sum(scene_holds)) / 8
    cursor, all_captions, clips, evidence = 0.0, [], [], []
    for index, scene in enumerate(audio["scenes"]):
        scene_duration = math.ceil((scene["duration"] + scene_holds[index] + extra_hold) * FPS) / FPS
        shot_definitions = frame_scenes[scene["id"]]["shots"]
        shot_images = [compose_shot(scene, index, shot, args.frames.parent, audio["cut"], frames.get("urlLabel", "SecondCrate product walkthrough")) for shot in shot_definitions]
        for number, shot_image in enumerate(shot_images):
            shot_image.save(build / f"scene-{scene['id']}-shot-{number + 1}.png")
        transcribed = load_json(Path(scene["words"]))
        aligned = source_aligned_words(transcribed["words"], scene["text"], corrections.get(scene["id"], []))
        captions = caption_words(aligned, scene["duration"])
        for cue in captions:
            all_captions.append({**cue, "start": cue["start"] + cursor + 0.35, "end": cue["end"] + cursor + 0.35})
        evidence.append({"scene": scene["id"], "start": cursor, "duration": scene_duration, "narration": scene["text"], "recognizedText": transcribed.get("text", ""), "captionCorrections": corrections.get(scene["id"], []), "shots": shot_definitions})
        if args.preview_only:
            preview = shot_images[0].convert("RGBA")
            if captions:
                preview = Image.alpha_composite(preview, caption_overlay(captions[0]["text"]))
            preview.convert("RGB").save(build / f"preview-{scene['id']}.jpg", quality=94)
            cursor += scene_duration
            continue
        clip = build / f"scene-{scene['id']}.mp4"
        command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "pipe:0", "-i", str(scene["wav"]), "-filter:a", "adelay=350:all=1,apad", "-t", str(scene_duration), "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(clip)]
        weights = [float(shot.get("weight", 1)) for shot in shot_definitions]
        if min(weights) <= 0:
            raise ValueError("Shot weights must be positive.")
        boundaries, position = [], 0.0
        for weight in weights:
            position += scene_duration * weight / sum(weights)
            boundaries.append(position)
        rendered_states = {}
        with (build / f"scene-{scene['id']}.log").open("wb") as log:
            process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=log)
            try:
                for frame in range(round(scene_duration * FPS)):
                    t = frame / FPS
                    shot_index = next((j for j, boundary in enumerate(boundaries) if t < boundary), len(boundaries) - 1)
                    caption_index = next((j for j, cue in enumerate(captions) if cue["start"] + 0.35 <= t < cue["end"] + 0.35), -1)
                    state = (shot_index, caption_index)
                    if state not in rendered_states:
                        image = shot_images[shot_index].convert("RGBA")
                        if caption_index >= 0:
                            image = Image.alpha_composite(image, caption_overlay(captions[caption_index]["text"]))
                        # Cache stable frames. Cuts keep real product text sharp and legible.
                        rendered_states[state] = image.convert("RGB").tobytes()
                    process.stdin.write(rendered_states[state])
                process.stdin.close()
                if process.wait() != 0:
                    raise RuntimeError(f"FFmpeg failed for scene {scene['id']}; inspect its render log.")
            except BaseException:
                process.kill()
                process.wait()
                raise
        clips.append(clip)
        cursor += scene_duration
        print(f"Rendered scene {scene['id']}: {scene_duration:.1f}s", flush=True)
    srt = "\n\n".join(f"{i + 1}\n{timestamp(cue['start'])} --> {timestamp(cue['end'])}\n{cue['text']}" for i, cue in enumerate(all_captions)) + "\n"
    vtt = "WEBVTT\n\n" + "\n\n".join(f"{timestamp(cue['start'], True)} --> {timestamp(cue['end'], True)}\n{cue['text']}" for cue in all_captions) + "\n"
    args.output.with_suffix(".srt").write_text(srt)
    args.output.with_suffix(".vtt").write_text(vtt)
    (build / "caption-review.json").write_text(json.dumps({"cut": audio["cut"], "duration": cursor, "manualListeningReviewRequired": True, "scenes": evidence}, indent=2) + "\n")
    if args.preview_only:
        print(f"Prepared eight scene previews and timed captions in {build}. No final video rendered.")
        return
    concat = build / "concat.txt"
    concat.write_text("\n".join("file '" + str(clip).replace("'", "'\\''") + "'" for clip in clips) + "\n")
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-metadata", "title=SecondCrate: Every good lot deserves a buyer", "-metadata", "comment=Edited walkthrough of actual application screenshots. Synthetic demonstration data. AI narration: OpenAI cedar.", str(args.output)])
    cover = ImageOps.fit(Image.open(ROOT / "docs/assets/secondcrate-cover.png").convert("RGB"), (1280, 720), Image.Resampling.LANCZOS)
    cover_draw = ImageDraw.Draw(cover)
    cover_draw.rectangle((0, 671, 1280, 720), fill=cover.getpixel((10, 10)))
    cover_draw.text((80, 690), "PRODUCT DEMO / SYNTHETIC DATA", font=font(18, True), fill=LIME, anchor="lm")
    cover.save(args.output.with_name("SecondCrate-Thumbnail.jpg"), quality=95)
    actual_duration = duration(args.output)
    if abs(actual_duration - cursor) > 1.0:
        raise RuntimeError("Encoded duration differs from the planned caption timeline.")
    sources = sorted({shot["path"] for scene in frames["scenes"] for shot in scene["shots"] if "path" in shot})
    report = {"file": args.output.name, "cut": audio["cut"], "duration": actual_duration, "resolution": [WIDTH, HEIGHT], "fps": FPS, "captions": len(all_captions), "burnedCaptions": True, "disclosure": "AI narration: OpenAI cedar", "presentation": "Edited walkthrough using actual application screenshots; not continuous screen recording", "captureMethod": frames.get("captureMethod"), "syntheticData": True, "recordingLot": frames.get("recordingLot"), "sources": [{"file": path, "sha256": hashlib.sha256((args.frames.parent / path).read_bytes()).hexdigest()} for path in sources], "sceneStarts": [{"id": item["scene"], "start": item["start"], "duration": item["duration"]} for item in evidence], "captionCorrections": corrections, "sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(), "manualAudioAndVisualReviewRequired": True}
    args.output.with_name("SecondCrate-Video-Verification.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"Created {args.output}: {actual_duration:.1f}s, 1920x1080, {len(all_captions)} burned caption cues.")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        print(f"Media command failed with exit code {error.returncode}. Inspect the render logs.", file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        print(f"Video build stopped: {error}", file=sys.stderr)
        sys.exit(1)
