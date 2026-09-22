# SecondCrate demo recording report

Created by Shivam Gupta.

## Delivered assets

- SecondCrate-Demo.mp4: 1920x1080, 30fps H.264 video with 48kHz AAC narration, 2:45.9, approximately 6.4 MB.
- SecondCrate-Demo.srt and SecondCrate-Demo.vtt: 45 caption cues matching the burned captions.
- SecondCrate-Thumbnail.jpg: 1280x720 branded YouTube thumbnail.
- SecondCrate-Video-Verification.json: file hash, source capture hashes, scene starts and technical QA.

## What is shown

This is an edited walkthrough made from 20 views of actual Safari screenshots of https://secondcrate.web.app. It is not continuous screen recording. Crops improve readability; application text, results and controls were not recreated. The closing card is an original editorial graphic.

The isolated synthetic workspace uses lot SC-1045. The actual recorded result is 12 crates at £17, 20 at £18 and the final eight at £18, with Common Ground winning the concurrent stock test. That produces three orders, 40 crates, £708 booked sales, £480 book cost, £228 gross product spread and 200kg allocated. A real browser refresh retained these results.

The video explicitly labels simulated messaging and explains that AWS account activation still blocks AWS deployment and live service verification. The hosted Firestore rehearsal is not represented as qualifying AWS runtime evidence.

## Narration and captions

AI narration: OpenAI cedar, generated using gpt-4o-mini-tts. The stock voice does not impersonate Shivam. Whisper word timestamps were aligned with the exact frozen narration source, and script punctuation was restored. An initial audio review identified an unclear pronunciation of the buyer name Ben. Scene five was regenerated with an explicit pronunciation instruction. All eight final raw Whisper transcripts now match their source words without caption word corrections. The earlier audio review is preserved at docs/evidence/video-audio-review-first-pass.json with its original video hash. A fresh audio-input model review of the final video is tracked separately at docs/evidence/video-audio-review.json; it is an automated review, not human listening.

All 20 final encoded shot states were extracted and visually inspected. Every caption fits at most two lines in a reserved lower band that does not obscure the app. FFmpeg decoded the complete video successfully. Final audio measured -16.3 LUFS integrated and -1.4 dBFS true peak, below clipping. The closing card holds for approximately four seconds after the spoken ending.

## Chapters

- 0:00 A cancellation and a second chance
- 0:19 Review the available stock
- 0:40 Match the right buyers
- 0:57 Negotiate within clear boundaries
- 1:18 Test the final eight crates
- 1:41 Read the order ledger and economics
- 1:59 See the current runtime honestly
- 2:23 Commercial next steps

## Rebuild

Keep the reviewed screenshot manifest in .artifacts-build/video/frames.json, generate narration with scripts/generate-video-audio.mjs using a key supplied through stdin, then run python3 scripts/render-demo-video.py. The renderer rejects narration that differs from docs/VIDEO_SCRIPT.md and rejects unreviewed or missing application captures. No API credential is included in any deliverable.

An independent audio-input review using gpt-audio-1.5 confirmed the corrected name Ben, the financial figures and complete sentences, and recommended publication. Its qualitative pacing comments are subjective; this does not establish human listening verification. The full report and matching video hash are in docs/evidence/video-audio-review.json.
