# Hosted preview

SecondCrate's reviewer preview uses https://secondcrate.web.app with Firebase Hosting, a same-origin Cloud Run API and durable Firestore transactions. Each demo creates its own workspace. Outbound messages are simulated and reasoning is deterministic. This deployment does not establish the hackathon's required AWS runtime evidence. The AWS CDK deployment remains the live integration target.

The hosting project is `gen-lang-client-0444960702`. A newly created project, `secondcrate`, could not attach billing because the account's project billing quota was exhausted. The preview therefore uses only dedicated resources in an existing billed project. Existing applications and their databases were not changed.

Dedicated resources:

- Firebase Hosting site `secondcrate`.
- Cloud Run service `secondcrate` in `europe-west1`, zero minimum instances, maximum three instances, 512 MiB memory, concurrency 20.
- Artifact Registry Docker repository `secondcrate` in `europe-west1`.
- Named Firestore database `secondcrate` in `europe-west1`.
- Runtime service account `secondcrate@gen-lang-client-0444960702.iam.gserviceaccount.com`. Its `roles/datastore.user` binding has the condition `resource.name=="projects/gen-lang-client-0444960702/databases/secondcrate"`.

Firestore rules deny direct browser access. The server authenticates each request, derives tenant identity from the opaque session, and accesses Firestore through the scoped service account. Workspace snapshots use bounded 500 KB chunks inside atomic transactions, preserving the existing two MB aggregate limit and compare-and-swap stock allocation. Authentication mutations, rate counters and one-use reset tokens also use transactions. Demo records expire after seven days. Firestore TTL deletes them asynchronously; application reads enforce expiration immediately. The named database is billable and does not receive the default database's free quota.

Firebase forwards only the `__session` cookie to dynamic backends. The deployment sets `SESSION_COOKIE_NAME=__session`; cookies are Secure, HttpOnly and SameSite. `APP_ORIGIN` allows only the clean Firebase URL for browser writes. Every API response is `no-store` to prevent CDN session or tenant caching.

The public preview admits at most 100 new demo workspaces per fixed hour across all visitors. Each workspace has a separate 180-write allowance and 60-message allowance per 15 minutes. This is an explicit shared admission budget, not a claim of per-visitor IP enforcement. Forwarded IP headers are not trusted because a direct Cloud Run caller can supply them. Password login retains both account and aggregate rate limits. Cloud Run scales to zero with at most three instances. Stronger public abuse prevention would require a trusted edge or bot challenge before a larger rollout.

## Deploy an update

Authenticate with `gcloud auth login`, then run from the repository root:

```sh
node scripts/deploy-firebase.mjs
```

The script runs the complete application checks, builds a container in Cloud Build, updates only the SecondCrate service, publishes the built frontend with Firebase's official Hosting REST API, and runs the live HTTP smoke test. It keeps access tokens in process memory and never writes them to the repository. The API calls use `x-goog-user-project` for quota attribution. No API key is needed.

For frontend-only changes after `npm run build`:

```sh
node scripts/deploy-firebase-hosting.mjs
```

If using the Firebase CLI instead, `.firebaserc` and `firebase.json` identify the dedicated site and named database. Limit deployments to those targets. Do not deploy or modify another app's default Firestore database.

## First-time setup in a different project

Use a billing-enabled project, enable Cloud Run, Cloud Build, Artifact Registry, Firestore, Firebase Hosting and Firebase Rules APIs, and add Firebase to the project. Create a Hosting site whose ID is globally available. Create the named database, repository and runtime account listed above, changing project IDs as needed. Apply the database-scoped IAM condition, the rules in `firestore.rules`, payload index exemptions, and the `expiresAt` TTL policies in `firestore.indexes.json`. Update `.firebaserc`, the Hosting site, APP_ORIGIN and deployment script together. Never reuse another application's database.

Official references: [Cloud Run rewrites](https://firebase.google.com/docs/hosting/cloud-run), [session cookies and caching](https://firebase.google.com/docs/hosting/manage-cache), [Hosting REST deployment](https://firebase.google.com/docs/hosting/api-deploy), [database-scoped IAM](https://firebase.google.com/docs/firestore/manage-databases).
