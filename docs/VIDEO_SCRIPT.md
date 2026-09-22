# SecondCrate: three-minute product demonstration

**Created by Shivam Gupta.** The verified-AWS script is **361 words** across eight scenes. Aim for 2:45 to 3:00 including short pauses and interface response time. The words under the timestamps are the narration. This product-led script works with either a recorded human narrator or the disclosed OpenAI cedar stock voice; it does not impersonate Shivam's voice.

## Recording gate

The main script's AWS paragraph requires an actual successful Bedrock invocation and a genuine SES result for the message being shown. Until those exist, replace scene seven with the exact rehearsal paragraph below. A hosted demonstration with simulated messaging is still a rehearsal. It does not establish AWS hackathon eligibility.

Use actual application footage with a visible synthetic-data label. Show the status the provider actually returned. Do not substitute a mocked receipt, a diagram or a configured adapter for runtime evidence. Never show credentials or real unrelated customer details.

## Verbatim script

### 0:00–0:18

Forty crates of tomatoes. One cancelled restaurant order. A truck that leaves soon. Who takes the stock now? This is SecondCrate, created by Shivam Gupta. It helps produce wholesalers turn cancelled orders into confirmed sales through the buyers they already know.

### 0:18–0:40

This is Northstar Produce, our fictional demonstration wholesaler. I paste the cancellation and review the lot: forty crates, an eighteen-pound offer and a sixteen-pound minimum. The operator confirms the stock is available and sets the dispatch and delivery times. The delivery promise stays visible throughout the workflow.

### 0:40–1:00

SecondCrate checks which buyers fit the product, have permission to receive offers and can take the stock. It prepares their conversations across the configured channels. Every conversation shares the same inventory. Buyers do not need another app.

### 1:00–1:28

Maya asks for twelve crates at seventeen pounds, provided delivery is before two. The agent interprets the request; application rules check the price, quantity, capacity and delivery window. The order is confirmed. Here is a fourteen-pound request that was rejected. The agent cannot negotiate away the minimum.

### 1:28–1:51

Ben takes twenty crates at eighteen pounds. Eight remain. Now watch two buyers claim those final eight at the same time. This button sends two concurrent requests to the server. One succeeds. The other sees the remaining availability. Forty crates never become forty-eight promises. Refresh the page, and that result is still there.

### 1:51–2:13

The ledger now shows three orders: forty crates, two hundred kilograms allocated and seven hundred and eight pounds in booked sales. Subtract four hundred and eighty pounds in book cost, and the spread is two hundred and twenty-eight pounds, before handling, delivery and software.

### 2:13–2:37

Here is the AWS evidence: a real Bedrock interpretation and the Amazon SES provider result for the message shown. The audit connects the request, decision and order. Unconnected channels stay labelled simulated. Provider acceptance and delivery are separate states, so the operator can see what actually happened.

### 2:37–3:00

The proposed price is two hundred and ninety-nine pounds per depot each month. At five pounds contribution per additional crate, sixty extra crates cover it. Paid pilots will test those assumptions. SecondCrate gives good stock another buyer, and the depot a promise it can keep.

## Action storyboard

| Time      | Actual footage                                                                                                               | Keep readable                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 0:00–0:18 | Open on the branded login, then enter the isolated demo workspace.                                                           | “SecondCrate”, “Created by Shivam Gupta” and the cancelled-order hook.                     |
| 0:18–0:40 | Paste the cancellation in **New lot**, review extracted fields and confirm stock release.                                    | 40 crates, £18 offer, £16 floor, next-day 12:45 dispatch and 13:30 delivery, London time.  |
| 0:40–1:00 | Launch recovery and show suitable and excluded buyers.                                                                       | Buyer permission, capacity and actual simulated or live channel status.                    |
| 1:00–1:28 | Send Maya's £14 request, then her valid £17 conditional request. Show the order and the earlier rejection in agent activity. | 12 crates, £204, 28 remaining, rejection reason and delivery condition.                    |
| 1:28–1:51 | Confirm Ben's order, run **Test stock lock**, then refresh after the result.                                                 | 20 crates, eight left, two concurrent claims, one success, zero remaining after refresh.   |
| 1:51–2:13 | Show the selected lot's orders and impact calculation.                                                                       | Three orders, 40 crates, £708 booked sales, £480 book cost, £228 spread, 200 kg allocated. |
| 2:13–2:37 | Show the real runtime panel and matching evidence for the chosen cut.                                                        | A genuine model/provider result for a verified cut; explicit rehearsal state otherwise.    |
| 2:37–3:00 | Hold the result, then the simple branded closing card.                                                                       | “£299 / depot / month, proposed”, “Paid pilots: next step”, “Created by Shivam Gupta”.     |

Use one fresh workspace and one recording lot throughout. The starter lot can remain untouched, so frame the selected lot when showing its remaining stock. Record the actual stock-lock test; the winning buyer can vary. A browser refresh must retain the result before the script claims persistence.

The operator controls stock release. The delivery clock is an operational deadline, not an AI food-safety assessment. Booked orders are not payment collection or completed delivery.

## Exact fixture arithmetic

| Order                      | Quantity | Price | Booked sales |
| -------------------------- | -------: | ----: | -----------: |
| Maya / Olive & Rye         |       12 |   £17 |         £204 |
| Ben / The Sunday Table     |       20 |   £18 |         £360 |
| Winner of Leila/Priya race |        8 |   £18 |         £144 |
| Total                      |       40 |   n/a |         £708 |

Book cost: 40 × £12 = £480. Spread: £708 minus £480 = £228. Allocated weight: 40 × 5 kg = 200 kg. These are synthetic demonstration results, not verified waste prevention or customer traction.

## Pasteable cancellation and replies

Cancellation:

> Northstar Produce: please cancel the order for 40 crates of cherry tomatoes, 5 kg per crate. Original £24 per crate. The depot has these available for reassignment. Recovery offer £18, floor £16, book cost £12 per crate. Use the dispatch and delivery times reviewed by the operator.

Maya, blocked request:

> I can take 12 crates at £14 each.

Maya, valid conditional request:

> I can take 12 crates at £17 each if delivery is before 2 pm.

Ben:

> Confirm 20 crates at £18 each.

Leila and Priya, sent concurrently by **Test stock lock**:

> Confirm 8 crates at £18 each.

For the “before 2 pm” condition, create a lot for tomorrow with delivery at 13:30 London time and dispatch at 12:45 London time. Convert these values into the browser's local timezone when entering the form. Confirm the saved operational times before filming. Never use an expired cutoff or silently change a request to make it appear accepted.

## Exact rehearsal replacement: 2:13–2:37

Use this paragraph while live AWS evidence remains unavailable:

> This recording uses the isolated rehearsal. Messages are simulated, and the application says so. The inventory decisions run against the server and persist after refresh. AWS integrations are implemented, but account activation is still blocking AWS deployment and live service verification. This preview makes that boundary visible.

Use this paragraph for the hosted rehearsal at [secondcrate.web.app](https://secondcrate.web.app). It runs on Firebase Hosting, Cloud Run and Firestore. If the actual blocker changes, update the wording to the observed state before recording. Do not mix it with the verified-AWS paragraph.

## Optional verified WhatsApp cut

Only after the real outbound and inbound EUM Social flow, model invocation and SES confirmation are verified:

> This reply arrived through AWS End User Messaging Social on WhatsApp. Bedrock interpreted it, and the order checks ran before confirmation. Amazon SES returned the matching email result. The conversation crosses channels while the buyer, order and inventory stay connected. Each visible status matches the actual provider result.

## Voice and captions

Use an unhurried, conversational delivery. Pause after “Eight remain” and before the final line. Read prices as pounds, not currency symbols. Pronounce SecondCrate as “second crate”, Northstar as “north star”, and SES as the letters “S E S”. Use the stock cedar voice as itself; do not describe it as Shivam's recorded voice.

Captions must match the chosen audio, including the rehearsal paragraph. Use no more than two lines per cue, split at natural phrases, and keep them clear of the message composer and financial totals. Write visible prices as £17, £18, £708, £480, £228 and £299 where that improves legibility. Keep the words “booked sales”, “before handling, delivery and software” and “proposed” in the captions.

Burn in readable captions for silent viewing and upload a matching subtitle file. Check timing against the final audio, not these approximate scene markers. If AI narration is used, include “AI narration: OpenAI cedar” on the closing credit and in the YouTube description.

## Recording companion

Use [RECORDING_GUIDE.md](RECORDING_GUIDE.md) for the exact fixture and recording checks. Regenerate the [offline teleprompter](../deliverables/SecondCrate-Teleprompter.html) and printable script after changing this source; old generated files may contain earlier wording. [YOUTUBE.md](YOUTUBE.md) contains the title, description and publishing checks.
