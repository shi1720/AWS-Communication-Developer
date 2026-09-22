# SecondCrate: YouTube publishing pack

The title and description below are ready to paste for the current hosted rehearsal. All links in the description are verified release links. Add the public Devpost project link only after the project is published.

## Title

SecondCrate | Turn cancelled produce orders into confirmed sales

## Description

Forty crates of tomatoes. One cancelled restaurant order. A truck that leaves soon. Who takes the stock now?

SecondCrate helps produce wholesalers recover cancelled orders through buyers they already know. It checks buyer preferences and contact permission, interprets conditional replies, and enforces price, inventory and delivery rules before committing an order.

This demonstration follows fictional wholesaler Northstar Produce. Watch a below-floor request get rejected, a conditional order get accepted, and two buyers compete for the last eight crates. Only one gets the stock.

The result: three synthetic orders, 40 crates allocated and £708 in booked sales. The £228 spread above book cost excludes handling, delivery and software. These are demonstration figures, not customer results or measured food waste prevented.

Try the app: https://secondcrate.web.app
Source code and setup: https://github.com/shi1720/AWS-Communication-Developer

The public rehearsal runs on Firebase Hosting, Cloud Run and a dedicated Firestore database. It passed nine HTTP recovery checks plus hosted session-security and tenant-isolation checks. All messages are visibly simulated. The application also passed 115 automated tests and its production build.

AWS integrations are implemented, but required AWS service access remains blocked. The AWS deployment and live Bedrock/CDS verification are still pending. This public rehearsal does not yet satisfy the hackathon's AWS runtime requirements.

Created by Shivam Gupta for the AWS Communication Developer Services Agentic AI Partner Hackathon.
AI narration: OpenAI cedar. The narrator is a stock synthetic voice, not a recording of Shivam Gupta.
This walkthrough uses actual hosted application captures with timed narration and captions. Development used AI coding assistance. All businesses and buyer identities in the demonstration are fictional.

0:00 A cancelled order and a closing dispatch window
0:19 Review and release the stock
0:40 Find suitable buyers
0:57 A conditional order and a rejected discount
1:18 Two buyers, eight crates, one allocation
1:41 The order ledger and economics
1:59 Runtime status and evidence
2:23 The proposed business model

#SecondCrate #AWS #AgenticAI

## Replace the runtime paragraph only after verification

For a later verified AWS recording, replace the status paragraphs with the observed AWS region, actual model, successful CDS operation and the precise provider status shown. Name any channels that remain simulated. Provider acceptance alone must not be described as delivery. A controlled SES simulator result must be labelled as simulator evidence rather than a real buyer inbox.

## Publication checks

- Export an approximately three-minute 1920 × 1080 video with clear narration, readable screen text and burned-in captions. Upload the matching subtitle file as well.
- Use the final recording's exact chapter start times. The chapter values above match the final 2:46 export.
- Set the user-authorised visibility to **Public**. Confirm the resulting video plays from a signed-out browser and that the app and repository links work.
- Keep the title, description, runtime claims and captions consistent with the footage. Do not put an unresolved placeholder or private API key in any field.
- Check YouTube's actual disclosure options during upload and answer them accurately for the material used. The stock narration credit above should remain visible in the description.
- Save the public watch URL in `docs/DEVPOST_FIELDS.md` and the Devpost video field. Retain the master video, voiceover and subtitle files for corrections.

Suggested thumbnail: the actual SecondCrate recovery screen with **“40 crates. One more chance.”** and a small product wordmark. Use the project's own visuals and legible type. Do not imply real customer outcomes or an AWS endorsement.
