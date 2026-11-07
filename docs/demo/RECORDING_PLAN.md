# Writ demonstration recording plan

Frontend: https://writ-app.vercel.app/

Narration: [writ-voiceover.txt](writ-voiceover.txt). This file contains spoken words only and is ready to paste into ElevenLabs. Aim for a clear, conversational delivery. Final scene timings must follow the returned audio; the word count is not a measured duration.

Lead with the handover problem, then introduce Writ as a transferable digital key. Use everyday language through the walkthrough; reserve the short SDK and contract explanation for the ending. Pronounce **Writ** as **rit**, rhyming with **sit**. Do not read headings, production notes or on-screen captions aloud.

Use the deployed frontend for the main journey. The separate integration application currently runs locally on port 5174 and must be labelled as an independent local example. Its contract calls still use the same real testnet release.

## Capture sequence

| Scene                   | Visible action and required result                                                                                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening                 | Show the live landing page briefly, then enter the collection-administrator flow. Keep the opening short.                                                                                                                                                                           |
| Provision and mint      | Connect generated testnet Ada, create a fresh compatible collection target, review quotes and mint a new Writ. Capture the actual resulting target/executor/token IDs rather than inventing them in advance.                                                                        |
| Grant and verify        | Propose the executor, accept through Writ and confirm the role. Show the actual owner and the completed condition rows. A resumed step must be labelled as resumed, rather than presented as a new signature.                                                                       |
| Exercise the role       | Issue a fresh, uniquely named collectible. Confirm the successful final receipt and independently read the target's NFT record for the intended recipient.                                                                                                                          |
| Inspect authority       | Show approved commands, delegations, available native balance, account key permissions, upgrade-key disclosure and verified artwork. Use the actual target's observations.                                                                                                          |
| Delegate                | Grant Ben an exact-arguments, expiring `mint_collectible` command. Show that it is scoped and repeatable, not a one-use or unrestricted permission.                                                                                                                                 |
| Transfer                | Transfer the Writ directly to Ben. Show Ben as holder, old loans invalidated and Ada without holder controls. UI controls alone are not a new on-chain negative test; any separate rejection evidence must identify its actual receipt or sandbox provenance.                       |
| Integration breadth     | Briefly show the five real profiles. Do not imply that arbitrary existing contracts or every permission system are compatible. A DAO seat is one membership, not ownership of the entire DAO.                                                                                       |
| Optional sale/refund    | Inspect live Writ 2 and its pending-successor failure. Submit a new testnet purchase as Ben, observe refusal, withdraw the purchase-price refund and show its final paid state. Display the retained record charge and network-fee qualification.                                   |
| Independent application | Connect Ben separately at `http://127.0.0.1:5174`, inspect the new Writ, approve a fresh collectible command and confirm the receipt. Verify the external target's actual result. Show the independent local-app label.                                                             |
| Hand-back               | On the newly created Owner-based Writ, propose Ben's wallet, accept from that wallet and finish verification. Read back Ben as external owner and the retired NFT's absence. Recover remaining available native executor funds if any. Storage and operating reserves are excluded. |
| Close                   | Return to the product page or a clean closing frame with the site and repository links. Keep the upgrade-authority qualification in the narration and on-screen evidence.                                                                                                           |

## Recording rules

### Architecture cutaways

The editable [architecture scene](architecture-scene.mjs) follows the Teamfare treatment: a fixed diagram with highlighted parts and moving command paths. It uses Writ's Public Sans/Courier Prime fonts, white/black/yellow palette and the repository's real technology marks.

Run `node scripts/render-demo-architecture.mjs` from the repository root. It writes the self-contained HTML preview, vector SVG, poster, five highlighted states and narration cue anchors to ignored `.local/demo-architecture/`. Add `--video` to render a silent 20-second MP4 preview; FFmpeg must be on PATH or specified through `FFMPEG_PATH`.

Use the SDK cutaway in the SDK paragraph, return to the genuine hand-back recording, then show the contract flow and permission caveats during the technical ending. Match highlights to the returned audio using the stored narration anchors. Preview timings are placeholders, not final audio timing. The diagram depicts the signing/command path; read-only RPC traffic is omitted. It does not represent live transactions.

### Capture integrity

- Keep a visible **NEAR Testnet · Real transactions** label during signed scenes. Use generated test accounts; no mainnet funds or personal wallet imports.
- Never record seed phrases, private-key imports, local account files or browser developer tools containing signing material.
- Record genuine browser interaction with a visible cursor. Wait for actual final outcomes before presenting success.
- Edit transaction waits to fit the audio; label compressed waits. Do not present the edited runtime as a performance benchmark.
- Retain transaction hashes and readbacks in an ignored local capture journal. No duplicate payment after an uncertain outcome: inspect the existing attempt first.
- Verify current prices and state before recording. Previously used demonstration NFTs may have changed. Live Writ 7 is retired and must not be presented as active.
- Prepare and review the ElevenLabs audio before synchronizing the recording. No final video or public post is created by this plan.

## Completion evidence

Record the new Writ/target/executor identities, collectible records, transfer receipt, independent-app receipt, refused-purchase/refund receipts and hand-back/recovery receipts. Keep new capture evidence separate from the earlier signed rehearsal in [wallet-verification.json](../wallet-verification.json).
