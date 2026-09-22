# SecondCrate: Shivam’s recording guide

Use the [exact script](VIDEO_SCRIPT.md) and [offline teleprompter](../deliverables/SecondCrate-Teleprompter.html). Aim for three minutes of a clear product story, spoken in your own voice. The project creator is **Shivam Gupta**. Northstar Produce and every buyer in the rehearsal are fictional.

**Hosted application: [PENDING — insert the verified HTTPS application URL].** The repository README contains the current local start instructions. A local rehearsal can produce a development preview; the final hackathon entry still requires the AWS deployment and live qualifying service evidence.

## Choose the honest cut

| Cut | When to use it | Footage at 2:13 |
|---|---|---|
| Rehearsal — the teleprompter default | Live AWS evidence is incomplete | The actual simulated runtime status. Read the exact rehearsal paragraph. |
| Verified Bedrock + SES | Successful live inference and a genuine SES provider result have been captured | The model result and SES receipt, with only genuinely observed acceptance/delivery claims. |
| Verified WhatsApp | Real EUM Social outbound and inbound paths, Bedrock and SES have been exercised | The real message conversation, inbound event and matching confirmation evidence. |

Changing the teleprompter cut does not connect a service. Its evidence checkbox is a reminder, not verification. Keep “Synthetic demonstration data” and simulated channel labels visible. Show real providers using a controlled recipient that has agreed to the demonstration. Do not present the fictional buyer addresses as real destinations.

## Prepare one consistent recording lot

The starter lot uses the current time plus three hours for dispatch and another thirty minutes for delivery. Its deadline may not satisfy the script’s “before two” line. For the exact script, create a **new** recording lot for **tomorrow**, with **12:45 dispatch and 13:30 delivery in London time**. The form’s date inputs use your browser’s local timezone, while the product’s operational clock is London time.

If recording in India, London 12:45 / 13:30 corresponds to India 17:15 / 18:00 while London observes BST, or India 18:15 / 19:00 while London observes GMT. Check the date and offset when you record. After saving, verify the app displays the intended London times. Delivery must be at or after dispatch; the delivery promise must satisfy Maya’s 14:00 condition. Use the same tomorrow date for both fields.

1. Enter a fresh isolated demonstration workspace. Open **New lot**, paste the cancellation from `VIDEO_SCRIPT.md`, and use the extraction helper. Review every field: extraction uses local rules and does not replace operator review.
2. Set cherry tomatoes, Produce, 40 crates, 5 kg per crate, £24 original, £18 opening offer, £16 minimum and £12 book cost. Set the tomorrow schedule above. Confirm the stock-release checkbox and save.
3. Use this new lot throughout the recording; leave the starter lot untouched. Its unallocated stock will still exist in workspace totals; frame the selected recording lot when showing zero remaining. The buyer list should include the four eligible accounts below. Harbour Coffee lacks permission and Flour & Field requests another category, so they are unsuitable for this lot.
4. Launch recovery on the recording lot. Rehearsal sends remain simulated. For a live cut, configure the actual services and controlled buyer contacts through the documented setup before enabling sending.
5. In Maya’s conversation, submit the £14 request first. It must produce no order. Then submit: “I can take 12 crates at £17 each if delivery is before 2 pm.” It should confirm £204 and leave 28 crates.
6. Submit Ben’s “Confirm 20 crates at £18 each.” It should confirm £360 and leave eight. Click **Test stock lock**, then **Send both requests simultaneously** in the dialog. This sends concurrent API requests for Leila and Priya; exactly one final order may succeed. The winner can vary.
7. Check three orders total 40 crates and £708. Confirm zero remaining on the recording lot, £480 book cost, £228 spread and 200 kg allocated. These are synthetic booked orders, not collected cash, completed deliveries or measured waste avoided.
8. Export the order ledger and workspace archive after the take so the recorded result has a matching record. Keep any real contact data private; these exports are not automatically redacted.

| Buyer | Channel in fixture | Capacity |
|---|---|---:|
| Maya Chen / Olive & Rye | WhatsApp | 16 crates |
| Ben Carter / The Sunday Table | SMS | 24 crates |
| Leila Haddad / Ember Kitchen | Email | 12 crates |
| Priya Shah / Common Ground | WhatsApp | 12 crates |

If a run does not match the expected result, stop and fix the fixture or behavior before filming. Do not splice unrelated workspace results into a supposedly continuous transaction. The optional buyer-editing, cancellation-review and uncertain-send reconciliation tools are useful review evidence, but the three-minute story does not need a tour of every screen.

## Teleprompter setup

Double-click `SecondCrate-Teleprompter.html`. It has no external dependencies or network calls. Put it on a second display/device or outside the portion of your screen being recorded. Start with 48 px type and 1× pace, then rehearse once. The timer stops at 3:00; it measures active playback time and does not record video. Scrolling manually pauses playback. A backgrounded browser tab also pauses it, so keep the prompter visible while recording.

**Space** starts/pauses, **R** resets, **+ / −** changes type size, **↑ / ↓** changes pace, **T** switches theme and **F** requests full screen. Shortcuts do not override focused form controls. Clicking a cut resets the narration and timer. Rehearsal and verified cuts differ only at 2:13, exactly as specified in the script. The print PDF contains the main verified-AWS script and identifies its evidence gate.

## Record on a Mac

1. Arrange the product browser at a readable size, ideally within a 16:9 frame. Close unrelated tabs, silence notifications, and keep account credentials out of the capture. Make a ten-second audio test before the full take.
2. Press **Shift–Command–5**, choose **Record Selected Portion**, and frame only the product area. Under **Options**, choose your microphone, a five-second start timer, and a known save location. Enable visible mouse clicks if helpful. Start recording and follow the storyboard below.
3. Stop with the menu-bar stop control or **Control–Command–Escape**. Play the result and check legibility, microphone level and the final ledger. Trim only dead time; preserve the actual sequence and outcomes. These are Apple’s supported [screen-recording controls](https://support.apple.com/en-ie/102618).

If speaking while clicking feels rushed, record the real product actions first and record the narration separately. In QuickTime Player, use **File → New Audio Recording**, select your microphone, record the script and save the audio. This follows Apple’s [audio-recording instructions](https://support.apple.com/en-my/guide/quicktime-player/qtpf25d6f827/mac). The narration can then be aligned to the clips in your video editor; do not alter the order or result of product actions. No music is needed.

## Scene timing

| Time | Picture | Spoken emphasis |
|---|---|---|
| 0:00–0:18 | Landing page into the fictional Northstar workspace | A restaurant cancels forty crates. Who takes them? |
| 0:18–0:40 | Paste cancellation, review lot and stock release | The operator owns stock release and operational deadlines. |
| 0:40–1:00 | Launch and buyer eligibility | Existing relationships and permission to contact. |
| 1:00–1:28 | Maya’s £14 rejection, then £17 conditional order; audit | The application checks what the model proposes. |
| 1:28–1:51 | Ben’s order, then **Test stock lock** | Eight remain; two simultaneous claims; one succeeds. |
| 1:51–2:13 | Orders and financial summary | £708 booked sales, £228 spread, 200 kg allocated. |
| 2:13–2:37 | Runtime/evidence view matching the chosen cut | Real provider status or explicit rehearsal disclosure. |
| 2:37–3:00 | Dashboard and simple closing title | £299 proposed price; paid pilots are the next test. |

Closing card: **SecondCrate · Every good lot deserves a buyer · Shivam Gupta**. A small “Proposed: £299 / depot / month” line is enough. The pitch deck is supporting material; the main video should show the working product.

## Final handoff

Save the master video and the unedited narration. Check captions against the exact script, especially the prices. Publish the final approximately three-minute video to a public YouTube or Vimeo URL as required by the hackathon, then place that link, the verified hosted URL and the actual ACE opportunity ID in [SUBMISSION.md](SUBMISSION.md). Verify the link in a signed-out browser. Keep judge access available throughout judging. The current status register is [REQUIREMENTS.md](REQUIREMENTS.md).
