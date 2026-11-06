# Frontend brief resolutions

Approved by the user on 6 November 2026: fix the identified gaps and build the frontend.

Subsequent user-directed revision on the same date: top-align hero copy with the NFT card; reduce the hero/role display weights to Public Sans 600 while preserving body/typed text; remove the landing purchase exercise and its pale-yellow background; replace it with a slanted yellow technology marquee using upstream brand marks. Reframe the landing explanation around transferable role authority, with sales as an optional flow. Motion has a pause control and a static reduced-motion layout. These user directions supersede the original brief for those elements.

- React 18.3.1 replaces the starter's React 19; TypeScript is explicitly strict.
- No canvas exports were present. Written tokens/component specifications govern this build. Missing narrative copy describes implemented behavior.
- NEAR Connect and near-api-js follow current NEAR docs. No signing material is bundled.
- NEAR Connect's default dark/rounded picker is replaced by Writ's modal. Wallet options still come from its real manifest, and connecting uses the SDK with the chosen wallet ID.
- Settlement copy describes returned observations during a purchase, not a simultaneous global snapshot or permanent external-state guarantee.
- Refused, refund pending, refund claimable and refund paid are separate states. Network fees are excluded from refund claims.
- Submission is not settlement. Unconfirmed purchases keep their attempt ID and do not invite another payment. Wallet rejection preserves entered conditions.
- Testnet fee allowance uses current gas price, the requested gas budget and a buffer. It is a preflight allowance, not a fixed actual-fee claim.
- Mock delegation binds exact arguments, deposit, expiry and epoch. Real enforcement belongs in the contract.
- Page-only key/code checks remain distinct from sale checks. Missing evidence is unavailable, never Pass.
- Public Sans 500 and 800 are included because the design uses them. Fallback metrics are measured; absolute zero shift across platforms is not claimed.
- Accessibility's violet focus ring takes precedence over the button section's black ring.
- Ledger perforations/progress stripes are explicit gradient exceptions. Refused ledger text follows the ledger's explicit color exception. Rings/spinners follow their component specifications.
- One primary action applies per action group, preserving the specified yellow nav connect button and hero CTA.
- Every fixture page carries an example banner. No invented transaction links or sandbox-validation claims.
- DAO/pool templates remain research drafts and are not promoted until genuine sandbox gates pass.
- Testnet minting/unwrap are disabled until their integrations exist. Burning an NFT alone is not a verified role hand-back.
- The development gallery is excluded from production. Static hosting configuration targets Vercel/Netlify; no external publication was performed.

Latest user revision: restore the original display thickness (hero 800, role titles 900), retaining the raised layout and technology strip. Generated fonts, copied public docs/licenses, local screenshots and build instructions stay out of Git; fonts regenerate through the npm dev/build/test lifecycle.

User-authorized motion revision: add subtle one-time scroll reveals with 60?180 ms stagger and 14 px rise. Reduced-motion users, focused controls and printed content stay visible. No files are staged or committed by this work.
