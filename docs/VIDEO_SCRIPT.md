# SecondCrate: three-minute demonstration

**Speaker: Shivam Gupta.** The spoken script below is **344 words**, arranged into a 3:00 timeline at an unhurried pace with room for the interface to respond. Speak only the paragraphs under the timestamps. The storyboard and preparation notes are not narration. Rehearse against the timeline; word count alone cannot guarantee an exact recording duration.

## Recording gate

The main script is for the release with a **verified Bedrock invocation and a real SES provider result**. Record those clips before using the AWS paragraph. If services are not connected, use the exact rehearsal replacement at the end; that cut is a development preview, not evidence that the AWS submission requirements are complete.

Northstar Produce and the buyer data are fictional. Do not use unrelated customer data, third-party music, or unlicensed logos. Keep an on-screen “Synthetic demonstration data” label and the actual runtime/channel status visible where appropriate. Use a 1920 × 1080 recording, readable browser zoom, a clean microphone and captions. Let the product occupy the screen; a small speaker inset is optional.

## Verbatim script

### 0:00–0:18

I’m Shivam Gupta, and this is SecondCrate: a second destination for cancelled wholesale orders. Imagine a London restaurant cancels forty crates of cherry tomatoes. The stock is ready. The truck leaves soon. Who takes it now?

### 0:18–0:40

This is Northstar Produce, our fictional demonstration wholesaler. I paste the cancellation, review forty crates, and set an eighteen-pound offer with a sixteen-pound floor. The operator confirms the stock can be released. This clock is a dispatch cutoff, never an AI food-safety decision.

### 0:40–1:00

SecondCrate checks the existing buyer list: product preferences, permission to contact, capacity, and delivery constraints. It prepares suitable offers across the connected channels. The customer stays in their conversation; the coordinator sees one shared inventory ledger.

### 1:00–1:28

Maya replies: twelve crates at seventeen pounds, if delivery is before two. The agent interprets the conditions, then the application checks them. Seventeen is above the floor, twelve fits her capacity, and delivery fits the plan. The order is confirmed. A below-floor request is blocked, with the reason visible.

### 1:28–1:51

Ben takes twenty crates at eighteen pounds. Eight remain. Now two buyers claim those final eight at the same time. This replay sends concurrent requests. Only one order succeeds. The second buyer gets the actual remaining availability. No double sale, even when replies arrive together.

### 1:51–2:13

Here is the order ledger: forty crates, two hundred kilograms allocated, and seven hundred and eight pounds in booked sales. That is not profit or cash collected. The book-cost spread is two hundred and twenty-eight pounds, before handling, delivery and software.

### 2:13–2:37

The AWS evidence is here: Bedrock interprets a request, and Amazon SES returns a provider message identifier for an order confirmation. The receipt shows the actual result. Simulated channels remain labelled. A provider accepting a message is distinct from the customer receiving it.

### 2:37–3:00

SecondCrate’s proposed price is two hundred and ninety-nine pounds per depot each month. At five pounds contribution per additional crate, sixty additional crates cover it. Those are assumptions to validate with paid pilots, not claimed traction. SecondCrate turns a cancelled order into a conversation that can commit the right next order.

## Action storyboard

| Time | On-screen action | Evidence and presentation |
|---|---|---|
| 0:00–0:18 | Start on the SecondCrate landing page, then enter the isolated demonstration workspace. | Title: “SecondCrate · Shivam Gupta”. Show the cancellation story immediately. |
| 0:18–0:40 | Open the **New lot** flow; paste the cancellation, review the fields, and confirm stock release. | 40 crates × 5 kg; £24 original; £18 offer; £16 floor; £12 book cost. For this exact script, create a fresh lot for tomorrow: dispatch 12:45 and delivery 13:30 London time. Convert these to the browser’s local timezone when entering the form. |
| 0:40–1:00 | Launch recovery; show buyer eligibility and the resulting messages. | Maya Chen / Olive & Rye: WhatsApp, capacity 16. Ben Carter / The Sunday Table: SMS, capacity 24. Leila Haddad / Ember Kitchen: email, capacity 12. Priya Shah / Common Ground: WhatsApp, capacity 12. The channel badge must show simulation if applicable. |
| 1:00–1:28 | Show Maya's conditional request and the agent/tool audit; briefly expose a below-floor rejection. | Maya's confirmed order: 12 crates at £17, total £204. Use the exact delivery constraint the fixture can meet. An earlier £14 request can supply the blocked example; it must not produce an order. |
| 1:28–1:51 | Confirm Ben's 20 crates at £18, then click **Test stock lock**, followed by **Send both requests simultaneously**, using Leila and Priya. | Ben total £360. The control sends two real concurrent API requests with distinct event IDs, 8 crates each at £18. Only one additional 8-crate order; the winning name may vary. The persisted result must show 40 allocated and 0 remaining. |
| 1:51–2:13 | Open the order ledger and financial summary. | Three orders, 40 crates, £708 sales, £480 book cost, £228 spread; 200 kg allocated. Record dispatch as a separate action only if actually performed. |
| 2:13–2:37 | Show the live runtime settings, one successful Bedrock trace and one real SES result/controlled recipient inbox. | Redact credentials and unrelated personal information. Provider acceptance does not prove delivery; use only the observed status. Keep a simulated WhatsApp/SMS badge visible if those channels are unconnected. |
| 2:37–3:00 | Return to the clean dashboard, then a closing card. | “£299 / depot / month — proposed” and “Paid pilots: next step”. End at 3:00, with no extended outro. |

## Exact fixture arithmetic

| Order | Quantity | Price | Sales |
|---|---:|---:|---:|
| Maya / Olive & Rye | 12 | £17 | £204 |
| Ben / The Sunday Table | 20 | £18 | £360 |
| Winner of Leila/Priya race | 8 | £18 | £144 |
| Total | 40 | — | £708 |

Book cost: 40 × £12 = £480. Spread: £708 − £480 = £228. Weight allocated: 40 × 5 kg = 200 kg. This fixture is not a real transaction or a claim of measured waste prevention.

Use a fresh isolated workspace for each rehearsal. Create one recording lot and use it consistently; the starter lot can remain untouched. Do not silently mix results from both lots. Verify each scenario against the final build. If any interaction behaves differently, fix the behavior or revise the narration; do not edit footage to imply an action happened when it did not. Short cuts to remove waiting are acceptable if the actual sequence and outcomes remain clear.

## Pasteable cancellation and replies

Cancellation text:

> Northstar Produce — please cancel today's order for 40 crates of cherry tomatoes, 5 kg per crate. Original £24 per crate. The depot has these available for reassignment. Recovery offer £18, floor £16, book cost £12 per crate. Use the dispatch and delivery times reviewed by the operator.

Maya's first, deliberately blocked request:

> I can take 12 crates at £14 each.

Maya's valid conditional request:

> I can take 12 crates at £17 each if delivery is before 2 pm.

Ben:

> Confirm 20 crates at £18 each.

Leila and Priya, sent concurrently with separate event IDs:

> Confirm 8 crates at £18 each.

The “before 2 pm” scenario requires a fixture whose delivery time is earlier than 14:00 London time. Use the same operational timezone in the UI, server fixture and narration. If filming later in the day, use an explicitly dated next-day scenario or change the delivery phrase throughout; never rely on an already expired cutoff.

## Exact rehearsal replacement: 2:13–2:37

Use this paragraph instead of the main AWS paragraph when live AWS evidence is not available:

> This recording uses the isolated rehearsal. Messages are simulated, and the runtime says so. The AWS adapters are included, but live Bedrock inference and real message delivery still need verification. The inventory checks run in the application; this preview does not claim completed cloud deployment.

Do not paste the AWS-verified paragraph into a rehearsal recording.

## Optional verified WhatsApp cut

If AWS EUM Social is genuinely connected, replace the 2:13–2:37 paragraph with the following, and show matching evidence:

> This WhatsApp reply arrived through AWS End User Messaging Social. Bedrock interpreted it, and the order checks ran before confirmation. Amazon SES sent the matching email. Here are the provider receipts. The conversation crosses channels while its inventory, buyer and order stay connected. Each displayed status reflects the actual provider result.

Only use this version after exercising both the outbound Social SDK call and its inbound event path. A WhatsApp-shaped rehearsal panel does not establish WhatsApp prize eligibility.

## Recording companion

Use [RECORDING_GUIDE.md](RECORDING_GUIDE.md) for the exact click sequence and timezone setup. [SecondCrate-Teleprompter.html](../deliverables/SecondCrate-Teleprompter.html) runs offline and defaults to the truthful rehearsal cut. Its verified-AWS mode is gated by the evidence described above.
