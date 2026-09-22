# SecondCrate: Shivam’s recording guide

Use the [exact script](VIDEO_SCRIPT.md) and regenerated [offline teleprompter](../deliverables/SecondCrate-Teleprompter.html). Aim for 2:45 to 3:00 of a clear product story. The creator is **Shivam Gupta**. Narration can be recorded by Shivam or generated with the disclosed OpenAI cedar stock voice. Do not present a stock synthetic voice as Shivam's voice. Northstar Produce and every buyer in the rehearsal are fictional.

**Hosted application: [secondcrate.web.app](https://secondcrate.web.app).** Firebase Hosting serves the public rehearsal, Cloud Run executes the application, and a dedicated Firestore database persists its state. The hosted HTTP workflow passed nine checks with zero external messages sent. The final hackathon entry still requires the separate AWS deployment and live qualifying service evidence.

The finished rehearsal video is available at [the hosted watch page](https://secondcrate.web.app/demo.html). It lasts 2:46, uses actual application captures edited for clarity, and includes OpenAI cedar narration with burned-in captions. The scene schedule below remains a recording guide; exact final chapter times are in [the video verification record](../deliverables/SecondCrate-Video-Verification.json).

## Choose the honest cut

| Cut                                 | When to use it                                                                  | Footage at 2:13                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Rehearsal, the teleprompter default | Live AWS evidence is incomplete                                                 | The actual simulated runtime status. Read the exact rehearsal paragraph.                   |
| Verified Bedrock + SES              | Successful live inference and a genuine SES provider result have been captured  | The model result and SES receipt, with only genuinely observed acceptance/delivery claims. |
| Verified WhatsApp                   | Real EUM Social outbound and inbound paths, Bedrock and SES have been exercised | The real message conversation, inbound event and matching confirmation evidence.           |

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
7. Refresh the browser and confirm that the allocation persisted. Check three orders total 40 crates and £708. Confirm zero remaining on the recording lot, £480 book cost, £228 spread and 200 kg allocated. These are synthetic booked orders, not collected cash, completed deliveries or measured waste avoided.
8. Export the order ledger and workspace archive after the take so the recorded result has a matching record. Keep any real contact data private; these exports are not automatically redacted.

| Buyer                         | Channel in fixture |  Capacity |
| ----------------------------- | ------------------ | --------: |
| Maya Chen / Olive & Rye       | WhatsApp           | 16 crates |
| Ben Carter / The Sunday Table | SMS                | 24 crates |
| Leila Haddad / Ember Kitchen  | Email              | 12 crates |
| Priya Shah / Common Ground    | WhatsApp           | 12 crates |

If a run does not match the expected result, stop and fix the fixture or behavior before filming. Do not splice unrelated workspace results into a supposedly continuous transaction. The optional buyer-editing, cancellation-review and uncertain-send reconciliation tools are useful review evidence, but the three-minute story does not need a tour of every screen.

## Teleprompter setup

Double-click `SecondCrate-Teleprompter.html`. It has no external dependencies or network calls. Put it on a second display/device or outside the portion of your screen being recorded. Start with 48 px type and 1× pace, then rehearse once. The timer stops at 3:00; it measures active playback time and does not record video. Scrolling manually pauses playback. A backgrounded browser tab also pauses it, so keep the prompter visible while recording.

**Space** starts/pauses, **R** resets, **+ / −** changes type size, **↑ / ↓** changes pace, **T** switches theme and **F** requests full screen. Shortcuts do not override focused form controls. Clicking a cut resets the narration and timer. Rehearsal and verified cuts differ only at 2:13, exactly as specified in the script. The print PDF uses the current rehearsal cut. Verified-AWS alternatives remain in the Markdown source until that evidence exists.

## Record on a Mac

1. Arrange the product browser at a readable size, ideally within a 16:9 frame. Close unrelated tabs, silence notifications, and keep account credentials out of the capture. Make a ten-second audio test before the full take.
2. Press **Shift–Command–5**, choose **Record Selected Portion**, and frame only the product area. Under **Options**, choose your microphone, a five-second start timer, and a known save location. Enable visible mouse clicks if helpful. Start recording and follow the storyboard below.
3. Stop with the menu-bar stop control or **Control–Command–Escape**. Play the result and check legibility, microphone level and the final ledger. Trim only dead time; preserve the actual sequence and outcomes. These are Apple’s supported [screen-recording controls](https://support.apple.com/en-ie/102618).

If speaking while clicking feels rushed, record the real product actions first and record the narration separately. In QuickTime Player, use **File → New Audio Recording**, select your microphone, record the script and save the audio. This follows Apple’s [audio-recording instructions](https://support.apple.com/en-my/guide/quicktime-player/qtpf25d6f827/mac). Alternatively, generate the selected script with the OpenAI cedar stock voice and add the AI narration credit. Align the narration to the actual clips without altering the order or result of product actions. No music is needed.

## Scene timing

| Time      | Picture                                                 | Spoken emphasis                                                    |
| --------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| 0:00–0:18 | Landing page into the fictional Northstar workspace     | A restaurant cancels forty crates. Who takes them?                 |
| 0:18–0:40 | Paste cancellation, review lot and stock release        | The operator owns stock release and operational deadlines.         |
| 0:40–1:00 | Launch and buyer eligibility                            | Existing relationships and permission to contact.                  |
| 1:00–1:28 | Maya’s £14 rejection, then £17 conditional order; audit | The application checks what the model proposes.                    |
| 1:28–1:51 | Ben’s order, **Test stock lock**, then refresh          | Eight remain; two simultaneous claims; one persists after refresh. |
| 1:51–2:13 | Orders and financial summary                            | £708 booked sales, £228 spread, 200 kg allocated.                  |
| 2:13–2:37 | Runtime/evidence view matching the chosen cut           | Real provider status or explicit rehearsal disclosure.             |
| 2:37–3:00 | Dashboard and simple closing title                      | £299 proposed price; paid pilots are the next test.                |

Closing card: **SecondCrate · Every good lot deserves a buyer · Created by Shivam Gupta**. Add “Proposed: £299 / depot / month” and, when applicable, “AI narration: OpenAI cedar”. The pitch deck is supporting material; the main video should show the working product.

## Caption and sound check

Use the selected narration as the caption source. Align cues to the final audio, with no more than two readable lines at once. Keep captions above the bottom interface controls and away from the totals being discussed. Read the exported captions for the critical figures: £14 rejected, 12 at £17, 20 at £18, eight remaining, £708 booked sales and £228 before handling, delivery and software.

Listen to the entire export through headphones and ordinary laptop speakers. Speech must remain clear without sharp level changes or clipped words. Check that “SecondCrate”, “Bedrock” and “SES” are pronounced clearly. Review the video once without sound to confirm the captions carry the complete story. Keep both a burned-in-caption master and the matching subtitle file.

## Final handoff

Save the master video, unedited narration and subtitle file. Use [YOUTUBE.md](YOUTUBE.md) for the title and description. Publish the user-authorised video with Public visibility, then place the real watch link, verified application URL and actual ACE opportunity ID in [DEVPOST_FIELDS.md](DEVPOST_FIELDS.md) and the corresponding Devpost fields. Verify the links in a signed-out browser. Keep judge access available throughout judging. The current status register is [REQUIREMENTS.md](REQUIREMENTS.md).
