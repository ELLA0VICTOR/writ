# Writ demonstration video

[Watch or download the finished video](Writ-demo.mp4) · [Optional captions](Writ-captions.srt) · [Live application](https://writ-app.vercel.app/)

The video is **2 minutes 53.43 seconds**, 1920 × 1080, 30 fps, with H.264 video and AAC audio. The supplied narration plays at its original speed and timing. There are no tempo, volume or editorial changes to the voiceover; AAC encoding provides MP4 compatibility.

## What is shown

- Real interaction with the deployed Writ frontend, with a visible moving cursor.
- A fresh compatible collection, minting Writ **8**, and the actual Owner-role handover to `w8.writ-collection-mw5cm75f.testnet`.
- Ada issuing `ada-first-edition`, inspecting permissions and viewing the NFT in Intear Wallet.
- Scoped delegation followed by a direct transfer to Ben, invalidating the previous delegation.
- A refused purchase of Writ 2 and withdrawal of the **0.3 testnet NEAR** purchase-price refund. The retained record charge and network fees are disclosed.
- Ben issuing `ben-next-edition` through the separate SDK example, using his own wallet connection.
- Verified hand-back to Ben, retirement of Writ 8 and recovery of its remaining available native executor funds.
- The architecture illustration, with highlighted SDK, authorization, executor and external-role components matched to the technical ending.

All signed actions use **NEAR Testnet and generated test accounts**. Ada is the narration's alias for the Alice test account; Ben is the alias for the Bob test account. No mainnet funds were used.

The landing page's example NFT is labelled as a product illustration. The separate integration frontend runs locally and is explicitly labelled in the video. Browser footage plays at normal speed; transaction waits and repetitive setup are cut. This is an edited walkthrough, not a performance benchmark.

Writ 8 is intentionally retired at the end. Use the live application's other examples or create a new practice target to try the flow yourself.

## Evidence

- [Testnet receipts](Writ-testnet-receipts.json): 15 public final transaction receipts, paid refund, final external owner and recovered executor balance.
- [Video verification](Writ-video-verification.json): output dimensions, duration, frame count, file hash and audio waveform checks. Early and late speech windows match the source with no measured timing offset; the original and exported decoded narration durations are equal.
- [Recording plan](../docs/demo/RECORDING_PLAN.md) and [narration](../docs/demo/writ-voiceover.txt).

The finished MP4 passed complete media decoding and browser playback checks. Frames from each scene were reviewed for readable text, cursor visibility and correspondence with the narration.

## Editing sources

[edit-video.py](../docs/demo/edit-video.py) assembles the genuine recordings and architecture artwork. Maintainer reproduction requires the ignored raw capture journal, video files and original audio under `.local/video/`; those inputs and wallet profiles are not published. Set `FFMPEG_PATH` and `FFPROBE_PATH` when the tools are not on PATH.

The [architecture source](../docs/demo/architecture-scene.mjs) and [renderer](../scripts/render-demo-architecture.mjs) regenerate the diagram assets. Technology-mark provenance and font notices remain documented in the main repository. No hackathon submission, social post, Git commit or push is performed by these editing tools.
