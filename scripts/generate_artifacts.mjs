import fs from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = process.cwd();
const build = path.join(root, ".artifacts-build");
const out = path.join(root, "deliverables");
const runtime =
  process.env.CODEX_ARTIFACT_RUNTIME ??
  path.join(
    homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies",
  );
process.env.RUNTIME_NODE_MODULES ??= path.join(runtime, "node/node_modules");
const skill =
  process.env.CODEX_PRESENTATIONS_SKILL ??
  path.join(
    homedir(),
    ".codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations",
  );
const require = createRequire(path.join(runtime, "node", "package.json"));
const localRequire = createRequire(path.join(root, "package.json"));
const { Presentation, PresentationFile } = await import(
  pathToFileURL(require.resolve("@oai/artifact-tool"))
);
const { finalizePresentation } = await import(
  pathToFileURL(path.join(skill, "container_tools/artifact_tool_utils.mjs"))
);
await fs.mkdir(path.join(build, "previews"), { recursive: true });
await fs.mkdir(out, { recursive: true });

const C = {
  green: "#244c3a",
  lime: "#d4e9a8",
  cream: "#f7f8f5",
  clay: "#df865b",
  ink: "#183729",
  muted: "#617065",
  line: "#d8ded5",
  white: "#ffffff",
};
const font = "Liberation Sans";
const pres = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slides = [];
function txt(s, text, x, y, w, h, size = 28, color = C.ink, bold = false) {
  const box = s.shapes.add({
    geometry: "textbox",
    name: text.slice(0, 52),
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  box.text = text;
  box.text.style = {
    typeface: font,
    fontSize: size,
    color,
    bold,
    autoFit: "none",
    wrap: true,
  };
  return box;
}
function rect(s, x, y, w, h, fill, stroke = "none") {
  return s.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { fill: stroke, width: stroke === "none" ? 0 : 1.4 },
  });
}
function line(s, x1, y1, x2, y2, color = C.line, width = 2) {
  return s.shapes.add({
    geometry: "line",
    position: {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    },
    fill: "none",
    line: { fill: color, width },
  });
}
function connect(
  s,
  a,
  b,
  fromSide = "right",
  toSide = "left",
  color = C.muted,
) {
  return s.shapes.connect(a, b, {
    kind: "elbow",
    fromSide,
    toSide,
    line: { fill: color, width: 2.4 },
    tail: { type: "triangle", width: "sm", length: "sm" },
  });
}
function node(
  s,
  label,
  x,
  y,
  w,
  h,
  { fill = C.white, color = C.green, size = 25, sub = "" } = {},
) {
  const n = rect(s, x, y, w, h, fill, fill === C.white ? C.line : "none");
  txt(s, label, x + 18, y + 15, w - 36, 40, size, color, true);
  if (sub) txt(s, sub, x + 18, y + 54, w - 36, h - 56, 19, color);
  return n;
}
function slide(title, dark = false, notes = "") {
  const s = pres.slides.add();
  slides.push(s);
  s.background.fill = dark ? C.green : C.cream;
  if (title)
    txt(s, title, 64, 56, 1150, 106, 54, dark ? C.cream : C.green, true);
  txt(s, "SECONDCRATE", 64, 674, 280, 25, 15, dark ? C.lime : C.muted, true);
  txt(
    s,
    String(slides.length).padStart(2, "0"),
    1170,
    674,
    45,
    25,
    15,
    dark ? C.lime : C.muted,
  );
  s.speakerNotes.textFrame.setText(notes);
  return s;
}

// Reuse the original, repository-owned produce artwork without redesigning it.
const source = await fs.readFile(
  path.join(root, "src/client/Produce.tsx"),
  "utf8",
);
const { transform } = await import(
  pathToFileURL(localRequire.resolve("esbuild"))
);
const transformed = await transform(source, {
  loader: "tsx",
  format: "esm",
  jsx: "automatic",
});
const artModule = path.join(build, "produce.mjs");
await fs.writeFile(
  artModule,
  transformed.code.replace(
    '"react/jsx-runtime"',
    JSON.stringify(
      pathToFileURL(localRequire.resolve("react/jsx-runtime")).href,
    ),
  ),
);
const { Produce } = await import(pathToFileURL(artModule));
const { createElement } = await import(
  pathToFileURL(localRequire.resolve("react"))
);
const { renderToStaticMarkup } = await import(
  pathToFileURL(localRequire.resolve("react-dom/server"))
);
const produceSvg = renderToStaticMarkup(createElement(Produce)).replace(
  "<svg ",
  '<svg xmlns="http://www.w3.org/2000/svg" ',
);
await fs.writeFile(path.join(build, "produce.svg"), produceSvg);
const sharp = (await import(pathToFileURL(require.resolve("sharp")))).default;
const producePng = await sharp(Buffer.from(produceSvg))
  .resize(1200)
  .png()
  .toBuffer();
await fs.writeFile(path.join(build, "produce.png"), producePng);

{
  const s = slide(
    "",
    true,
    "Creator: Shivam Gupta. This is a new hackathon project. Original produce artwork comes from src/client/Produce.tsx. All Northstar Produce demo data is synthetic. Deployable architecture; cloud validation pending.",
  );
  txt(s, "SecondCrate", 64, 100, 1128, 124, 96, C.cream, true);
  txt(
    s,
    "Every good lot\ndeserves a buyer",
    68,
    259,
    650,
    190,
    57,
    C.lime,
    true,
  );
  txt(
    s,
    "Recovery for cancelled\nwholesale produce orders",
    70,
    476,
    600,
    96,
    29,
    C.cream,
  );
  s.images.add({
    blob: producePng,
    contentType: "image/png",
    alt: "Original SecondCrate produce crate illustration",
    fit: "contain",
    position: { left: 688, top: 176, width: 540, height: 365 },
  });
  txt(s, "Shivam Gupta", 71, 596, 520, 36, 24, C.lime, true);
  txt(s, "AWS CDS Agentic AI Partner Hackathon", 71, 631, 800, 28, 19, C.cream);
}
{
  const s = slide(
    "A cancelled order leaves a clock running",
    false,
    "Illustrative scenario. Northstar Produce is fictional. 40 crates x 5 kg = 200 kg. Dispatch cutoff is operational, not a food-safety judgement. Prices: £24 original, £18 recovery offer, £16 floor, £12 book cost.",
  );
  txt(s, "40", 64, 181, 495, 176, 148, C.clay, true);
  txt(s, "crates of cherry tomatoes", 74, 362, 485, 50, 34, C.green, true);
  txt(s, "200 kg already at the depot", 74, 424, 470, 68, 27, C.muted);
  const a = node(s, "An order cancels", 646, 204, 536, 122, {
    fill: C.lime,
    size: 34,
    sub: "The lot is already at the depot",
  });
  const b = node(s, "Dispatch approaches", 646, 401, 536, 122, {
    fill: C.white,
    size: 34,
    sub: "The operator sets the available window",
  });
  connect(s, a, b, "bottom", "top");
  txt(
    s,
    "Who can take the lot within the existing plan?",
    74,
    557,
    1060,
    55,
    31,
    C.green,
    true,
  );
  txt(
    s,
    "Illustrative London scenario. The operator sets the dispatch cutoff and releases the stock.",
    74,
    625,
    1085,
    34,
    17,
    C.muted,
  );
}
{
  const s = slide(
    "The buyer can answer in their own words",
    false,
    "Illustrative workflow, not a screenshot. Example request: 12 crates at £17 before 14:00. Deterministic checks enforce the £16 floor, buyer capacity and delivery limits. AWS channels remain simulated until configured and verified.",
  );
  txt(
    s,
    "“Twelve crates at seventeen pounds,\nif you can deliver before two.”",
    68,
    179,
    1125,
    118,
    43,
    C.green,
    true,
  );
  const a = node(s, "Cancellation", 70, 361, 245, 106, {
    sub: "Operator releases stock",
  });
  const b = node(s, "Buyer reply", 365, 361, 245, 106, {
    fill: C.lime,
    sub: "Agent interprets intent",
  });
  const c = node(s, "Rule checks", 660, 361, 245, 106, {
    sub: "Price, capacity, delivery",
  });
  const d = node(s, "Order", 955, 361, 245, 106, {
    fill: C.green,
    color: C.white,
    sub: "Commit available stock",
  });
  connect(s, a, b);
  connect(s, b, c);
  connect(s, c, d);
  txt(
    s,
    "One shared inventory ledger across connected channels",
    72,
    544,
    1130,
    52,
    32,
    C.green,
    true,
  );
  txt(
    s,
    "WhatsApp, SMS and email adapters. Illustrative workflow. Live provider validation pending.",
    72,
    614,
    1130,
    35,
    18,
    C.muted,
  );
}
{
  const s = slide(
    "Two buyers can claim the final eight",
    true,
    "Illustrative concurrent-claim scenario, reproduced by the project concurrency test before release. A conditional workspace update protects the remaining stock. Event IDs prevent repeated inbound events creating another order. The model proposes an intent; deterministic application code enforces all transactional limits.",
  );
  txt(s, "8", 68, 177, 328, 211, 174, C.lime, true);
  txt(s, "crates remain", 79, 398, 360, 53, 35, C.cream, true);
  const a = node(s, "Leila requests 8", 529, 213, 291, 92, {
    fill: C.cream,
    size: 26,
  });
  const b = node(s, "Priya requests 8", 529, 355, 291, 92, {
    fill: C.cream,
    size: 26,
  });
  const c = node(s, "One order", 938, 277, 271, 113, {
    fill: C.lime,
    size: 31,
    sub: "The other claim sees 0",
  });
  connect(s, a, c);
  connect(s, b, c);
  txt(s, "Conditional state update", 534, 479, 664, 43, 30, C.lime, true);
  txt(
    s,
    "Version checks and event IDs protect stock\nwhen replies race or providers retry.",
    534,
    535,
    677,
    78,
    27,
    C.cream,
  );
}
{
  const s = slide(
    "Deployable AWS architecture",
    false,
    "Cloud validation pending. Read infra/stack.ts and src/server/lambda.ts for the complete implementation. CloudFront serves private S3 web assets and routes /api/* to API Gateway and Lambda. Lambda calls Bedrock, DynamoDB and CDS SDKs. SES/Social/SMS events use an SNS topic, SQS queue and dead-letter queue. SES can store inbound MIME in private S3. Secrets Manager supplies the CloudFront origin verification secret. CloudWatch alarms publish to an operational SNS topic. DynamoDB uses snapshot chunks and a conditional transactional head, bounded to 2 MB. EventBridge periodically retries queued outbox work only, never unknown provider outcomes. Provider inbound routing currently binds to one configured live workspace; this is a stated scaling limitation.",
  );
  const browser = node(s, "Browser", 64, 310, 192, 96, {
    sub: "Session cookie",
    size: 24,
  });
  const cf = node(s, "CloudFront", 296, 310, 215, 96, {
    sub: "HTTPS entry",
    size: 25,
  });
  const api = node(s, "API + Lambda", 566, 310, 272, 96, {
    fill: C.green,
    color: C.white,
    sub: "Validated order service",
    size: 28,
  });
  const cds = node(s, "SES / EUM", 923, 310, 293, 96, {
    fill: C.lime,
    sub: "Email, WhatsApp, SMS",
    size: 27,
  });
  const ai = node(s, "Bedrock", 566, 173, 272, 89, {
    sub: "Constrained intent",
    size: 26,
  });
  const state = node(s, "DynamoDB", 566, 482, 272, 92, {
    sub: "Snapshot + CAS head",
    size: 25,
  });
  const s3 = node(s, "Private S3", 296, 482, 215, 92, {
    sub: "Static application",
    size: 24,
  });
  const events = node(s, "SNS + SQS", 923, 482, 293, 92, {
    sub: "Inbound events and DLQ",
    size: 26,
  });
  connect(s, browser, cf);
  connect(s, cf, api);
  connect(s, api, cds);
  connect(s, ai, api, "bottom", "top");
  connect(s, api, state, "bottom", "top");
  connect(s, cf, s3, "bottom", "top");
  connect(s, cds, events, "bottom", "top");
  connect(s, events, api, "left", "right");
  txt(
    s,
    "Cloud validation pending. Secrets Manager, CloudWatch and queued-send recovery support the application.",
    65,
    608,
    1162,
    28,
    18,
    C.muted,
  );
  txt(
    s,
    "Current provider-event configuration routes to one live workspace. Full diagram accompanies this deck.",
    65,
    638,
    1162,
    27,
    17,
    C.muted,
  );
}
{
  const s = slide(
    "The example books £708 in sales",
    false,
    "Synthetic example: 12 crates x £17 = £204; 20 x £18 = £360; 8 x £18 = £144. Total 40 crates, £708 booked sales, £480 book cost and £228 spread before handling, transport and software. 200 kg is allocated, not verified waste prevented. Proposed subscription £299/depot/month includes 25 workflows within stated messaging limits. With £5 contribution per additional crate, 60 additional crates cover £299. Hypotheses in docs/BUSINESS_CASE.md, not customer results.",
  );
  const values = [
    ["Buyer", "Crates", "Price", "Sales"],
    ["Olive & Rye", "12", "£17", "£204"],
    ["The Sunday Table", "20", "£18", "£360"],
    ["Final-stock winner", "8", "£18", "£144"],
    ["Total", "40", "", "£708"],
  ];
  const table = s.tables.add({
    rows: 5,
    columns: 4,
    left: 66,
    top: 197,
    width: 702,
    height: 304,
    columnWidths: [320, 110, 120, 152],
    values,
  });
  table.borders.assign({ fill: C.line, width: 1 });
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 4; c++) {
      const cell = table.getCell(r, c);
      cell.fill = r === 0 ? C.green : r === 4 ? C.lime : C.white;
      cell.text.style = {
        typeface: font,
        fontSize: 24,
        color: r === 0 ? C.white : C.green,
        bold: r === 0 || r === 4,
      };
    }
  txt(s, "£228", 849, 190, 366, 116, 76, C.green, true);
  txt(s, "above £480 book cost", 855, 304, 350, 62, 26, C.muted);
  line(s, 852, 404, 1196, 404);
  txt(s, "200 kg", 850, 434, 360, 93, 58, C.clay, true);
  txt(s, "allocated to orders", 855, 525, 349, 40, 24, C.muted);
  txt(
    s,
    "Handling, transport and software reduce the spread. Booked sales are distinct from cash collected.",
    69,
    603,
    1137,
    49,
    21,
    C.muted,
  );
}
{
  const s = slide(
    "The first buyer is a depot manager",
    false,
    "Primary sources checked 22 September 2026. WRAP: https://www.wrap.ngo/taking-action/food-drink/actions/surplus-food-waste-redistribution . Reports approximately 191,000 tonnes received by UK redistribution organisations in 2023. Historical sector context, not SecondCrate TAM or impact. Choco https://help.choco.com/en/articles/15821057-order-agent-whatsapp-and-email-forwarding already offers AI wholesale order capture. Too Good To Go https://www.toogoodtogo.com/en-gb/surplus-food-parcels already sells manufacturer/wholesaler surplus to consumers. SecondCrate proposes a focused cancelled-order recovery workflow through existing B2B relationships.",
  );
  txt(
    s,
    "One depot. Existing buyers.\nA missed order to recover.",
    69,
    184,
    636,
    156,
    43,
    C.green,
    true,
  );
  txt(
    s,
    "A proposed £299 monthly subscription",
    72,
    375,
    649,
    66,
    29,
    C.green,
    true,
  );
  txt(
    s,
    "60 additional crates at £5 contribution\nwould cover the monthly price.",
    72,
    460,
    645,
    87,
    29,
    C.muted,
  );
  txt(s, "191,000", 826, 194, 402, 99, 68, C.clay, true);
  txt(
    s,
    "tonnes redistributed\nin the UK in 2023",
    832,
    315,
    357,
    92,
    28,
    C.green,
    true,
  );
  txt(s, "WRAP redistribution survey [1]", 832, 430, 360, 43, 18, C.muted);
  txt(
    s,
    "Choco handles wholesale ordering. Too Good To Go sells surplus to consumers.\nSecondCrate focuses on cancellation recovery within an existing B2B network. [2, 3]",
    72,
    562,
    1140,
    72,
    21,
    C.muted,
  );
  txt(
    s,
    "Sources: [1] WRAP, 2023 survey. [2] Choco OrderAgent, July 2026. [3] Too Good To Go Parcels.",
    72,
    639,
    1140,
    26,
    15,
    C.muted,
  );
}
{
  const s = slide(
    "A paid pilot will test the business case",
    true,
    "Proposed pilot only. No customer interviews, pilots, revenue or customer outcomes claimed. Plan: ten distributor interviews, two-week baseline and four-week paid pilot with three depots. Continue if at least two renew at £299, median incremental benefit exceeds £598/month, coordinator effort falls at least 30%, no oversells/below-floor/unwanted sends occur, and support approaches one hour per depot per month. All thresholds are internal hypotheses in docs/BUSINESS_CASE.md. Deployment and live AWS validation remain pending. Creator Shivam Gupta.",
  );
  txt(s, "01", 70, 197, 150, 70, 50, C.lime, true);
  txt(
    s,
    "Understand the last three cancellations",
    232,
    207,
    972,
    61,
    32,
    C.cream,
    true,
  );
  txt(s, "02", 70, 323, 150, 70, 50, C.lime, true);
  txt(
    s,
    "Measure two weeks of the current process",
    232,
    333,
    972,
    61,
    32,
    C.cream,
    true,
  );
  txt(s, "03", 70, 449, 150, 70, 50, C.lime, true);
  txt(
    s,
    "Run a four-week paid pilot at three depots",
    232,
    459,
    972,
    61,
    32,
    C.cream,
    true,
  );
  txt(
    s,
    "Renewal and incremental contribution decide what happens next.",
    71,
    576,
    1140,
    50,
    29,
    C.lime,
    true,
  );
  txt(
    s,
    "Shivam Gupta  /  AI-assisted development  /  Cloud validation pending",
    72,
    636,
    1148,
    29,
    17,
    C.cream,
  );
}

for (let i = 0; i < slides.length; i++) {
  const png = await pres.export({
    slide: slides[i],
    format: "png",
    scale: 1.5,
  });
  await fs.writeFile(
    path.join(build, "previews", `slide-${i + 1}.png`),
    new Uint8Array(await png.arrayBuffer()),
  );
  const layout = await slides[i].export({ format: "layout" });
  await fs.writeFile(
    path.join(build, "previews", `slide-${i + 1}.layout.json`),
    await layout.text(),
  );
}
const candidate = path.join(build, "secondcrate-pitch-candidate.pptx");
await (await PresentationFile.exportPptx(pres)).save(candidate);
const final = path.join(
  out,
  process.env.SECONDCRATE_DECK_FILENAME ?? "SecondCrate-Pitch.pptx",
);
const result = await finalizePresentation({
  workspaceDir: root,
  candidatePath: candidate,
  finalPath: final,
  pythonExecutable: path.join(runtime, "python/bin/python3"),
  integrityValidatorPath: path.join(
    skill,
    "container_tools/inspect_presentation_package_integrity.py",
  ),
  layoutValidatorPath: path.join(
    skill,
    "container_tools/inspect_presentation_layout_geometry.py",
  ),
  layoutArgs: [
    "--expected-slide-size-emu",
    "12192000,6858000",
    "--validate-heading-fit",
    "--require-native-table-slide",
    "6",
  ],
  explicitTotalSlideCount: 8,
  requiredNativeTableOwnerSlides: [6],
  tableArithmeticContracts: [
    {
      slide: 6,
      table: 1,
      label_column: 0,
      total_row: 4,
      value_columns: [1, 3],
      component_rows: [1, 2, 3],
    },
  ],
  fontPolicy: { basis: "design", families: [font] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(build, path.basename(final) + ".validation.json"),
});
console.log(JSON.stringify(result, null, 2));
