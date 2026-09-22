# Development

Use Node.js 22+, `npm ci`, then `npm run dev`. Start with the isolated demo and synthetic contacts. Application state lives in ignored `.data`; never include it in commits.

Run `npm run check` and `npm run infra:synth` after a change. Run `npm run smoke` against the development app for changes affecting the recovery flow. Format source with `npm run format`. Keep changes and tests focused on externally observable behavior.

Inventory, consent and monetary constraints belong in deterministic service tools, never in model prompt wording alone. Persist side effects before delivery attempts. Any retry must preserve idempotency and uncertain-send semantics. New provider integrations must distinguish acceptance from delivery and include real-account verification instructions.

Keep documentation honest about what is implemented, simulated, tested locally and verified on AWS. Do not add fictional customer endorsements, revenue, emissions savings or proof of live service use.
