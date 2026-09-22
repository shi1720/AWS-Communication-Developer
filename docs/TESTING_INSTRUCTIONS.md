# Test SecondCrate

Open https://secondcrate.web.app and choose **Explore the interactive demo**. No account, payment or API key is required for this isolated demonstration workspace. It contains fictional buyer data. Demo delivery is simulated and is labelled in the interface.

1. Open **Conversations** and select the cherry-tomato recovery. If its status is Draft, choose **Launch recovery**. The lot starts with 40 crates at £18 each and a £16 minimum price.
2. Select Maya / Olive & Rye. Send **I can take 12 crates at £14 each.** Inspect the visible rejection and confirm that stock has not changed.
3. Send **I can take 12 crates at £17 each.** The order should total £204 and leave 28 crates. Open the agent activity panel to inspect the decision and checks.
4. Select Ben / The Sunday Table. Send **Confirm 20 crates at £18 each.** The order should total £360 and leave eight crates.
5. Choose **Test stock lock**, then **Send both requests simultaneously**. Two buyers request the final eight crates. Exactly one order should succeed; the winner can vary.
6. Check the selected lot: three orders, 40 crates allocated, zero remaining and £708 in booked sales. The book cost is £480, leaving £228 before handling, delivery and software. Open **Impact & value** to review the assumptions. In **Recovery desk**, choose **Export CSV** under **Confirmed orders** to download the ledger.
7. Open **Buyer network** to inspect editable buyer preferences, capacities and contact permission. Open **Settings** to inspect the actual runtime and channel status. Use **Reset demo** to repeat with clean data.

This public demo tests application behavior without contacting real buyers. The Settings screen identifies the actual runtime; AWS deployment and live provider verification are tracked separately in the release evidence. Message acceptance, delivery and simulation are displayed distinctly. The demo does not collect payment or determine food safety.

The hosted preview uses Firebase Hosting, Cloud Run and Firestore. Live AWS deployment and Bedrock/CDS verification remain pending.
