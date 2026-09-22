/** Deploy only the dedicated SecondCrate Cloud Run service and Hosting site.
 * Infrastructure bootstrap is documented in infra/firebase/README.md. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const aliases = JSON.parse(readFileSync(".firebaserc", "utf8"));
const project = process.env.FIREBASE_PROJECT_ID || aliases.projects.default;
const region = process.env.FIREBASE_REGION || "europe-west1";
const service = "secondcrate";
const tag = `release-${new Date()
  .toISOString()
  .replace(/[^0-9]/g, "")
  .slice(0, 14)}`;
const image = `${region}-docker.pkg.dev/${project}/${service}/app:${tag}`;
function run(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
}
run("npm", ["run", "check"]);
run("gcloud", [
  "builds",
  "submit",
  `--tag=${image}`,
  `--project=${project}`,
  "--quiet",
]);
run("gcloud", [
  "run",
  "deploy",
  service,
  `--image=${image}`,
  `--project=${project}`,
  `--region=${region}`,
  "--platform=managed",
  "--allow-unauthenticated",
  `--service-account=${service}@${project}.iam.gserviceaccount.com`,
  "--cpu=1",
  "--memory=512Mi",
  "--min-instances=0",
  "--max-instances=3",
  "--concurrency=20",
  "--timeout=60",
  "--port=8080",
  `--set-env-vars=NODE_ENV=production,HOST=0.0.0.0,FIRESTORE_PROJECT_ID=${project},FIRESTORE_DATABASE_ID=secondcrate,SESSION_COOKIE_NAME=__session,APP_ORIGIN=https://secondcrate.web.app,PUBLIC_DEMO_HOURLY_LIMIT=100`,
  "--quiet",
]);
run("node", ["scripts/deploy-firebase-hosting.mjs"]);
execFileSync("node", ["scripts/smoke.mjs"], {
  stdio: "inherit",
  env: { ...process.env, SECONDCRATE_URL: "https://secondcrate.web.app" },
});
