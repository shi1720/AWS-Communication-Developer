# SecondCrate implementation contract

Product: regional food wholesaler cancellation recovery using existing opted-in buyers. Fictional demo: Northstar Produce; 40 crates of cherry tomatoes, 5 kg/crate, £24 original, £18 offer, £16 floor, £12 book cost. Dispatch cutoff is operational, never a food-safety judgment. Creator/owner: Shivam Gupta. Currency GBP. **Shared types use pounds, rounded to two decimals; validate and use integer pence for arithmetic internally.**

API JSON, errors `{ error: string, code?: string }`, session cookie. UI uses same-origin `/api`.

- GET `/api/session` -> `{ user: SessionUser | null }`
- POST `/api/auth/demo` -> `{ user }` creates isolated demo workspace; no external sends.
- POST `/api/auth/register` `{name,email,password}` -> `{user}`
- POST `/api/auth/login` `{email,password}` -> `{user}`
- POST `/api/auth/logout` -> `{ok:true}`
- GET `/api/dashboard` -> DashboardResponse
- POST `/api/lots` `{product,category,description,quantity,unitKg,originalPrice,floorPrice,offerPrice,costPrice,dispatchBy,deliveryBy,sourceText,safetyAttested}` -> `{lot}`
- POST `/api/lots/extract` `{text}` -> `{draft: Partial<Lot>, model: string}` (optional; validate extracted proposal)
- POST `/api/lots/:id/launch` -> `{workspace,steps}` match consent/capacity/category/delivery limits, create outbound offers
- POST `/api/inbound` InboundInput -> `{workspace,result:AgentResult}` demo only; real inbound trusted AWS SNS/Lambda
- POST `/api/lots/:id/close` -> `{workspace}`
- POST `/api/orders/:id/dispatch` -> `{workspace}`
- POST `/api/buyers` Buyer minus id -> `{buyer}`
- PATCH `/api/buyers/:id` partial Buyer -> `{buyer}`
- PATCH `/api/settings` allowed settings -> `{settings}`
- POST `/api/demo/reset` -> `{workspace}` demo only
- GET `/api/export` -> CSV orders
- GET `/api/health` -> `{ok:true}`

Backend owns `src/server/` except `src/server/adapters/` and `src/server/lambda.ts`. AWS agent owns those adapters, lambda, infra. Root owns shared types and UI/package config. Store optimistic CAS; backend owns retry + idempotency. AWS adapters do not silently fallback to fake success. Adapter calls accept seeded demo gating upstream, live unknown outcomes visible.

Root will install dependencies. Coordinate additions by message. No commits by agents. Add own tests under unique paths.
