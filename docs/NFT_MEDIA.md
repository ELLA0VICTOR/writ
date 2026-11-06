# NFT metadata-image reference

`src/nft/renderWritSvg.ts` exports `renderWritSvg(writ): string` and `writMediaDataUri(writ): string`. The pure renderer produces standalone 1000×1000 SVGs with accessible title/description and embedded Fontsource Latin WOFF/WOFF2 subsets, choosing the smaller file for each face. Role display text, stamps and the seal use Public Sans 900. Dynamic text is XML escaped.

Held: white stub. Listed: yellow stub, violet LISTED stamp/price. Locked: black/yellow stub, red IN SALE stamp. Lent: pale-yellow stub, UTC expiry/method. Marketplace and public-record images use this generator.

`npm run fonts:svg` regenerates the embedded fonts after dependency updates. Licenses are copied to `public/fonts/licenses`. SVGs do not require remote fonts.

`scripts/build-contract-media.mjs` compiles eight lightweight owner/DAO status templates from this exact frontend renderer, plus one shared embedded font subset. `contracts/collection/src/media.rs` fills bounded dynamic values and `nft_token` returns a base64 standalone SVG data URI. Nothing is frozen at mint: holder, epoch, nonce, price and loans are read from current state. Long protocol account labels receive a bounded text width. Marketplaces can still cache earlier metadata.

The sandbox core test reads actual Wasm-generated metadata before/after transfer, checks embedded fonts and current holder, and rejects unresolved template markers. Source snapshots remain the frontend reference. Media bytes increase view responses, not per-token storage; account code stores the shared templates/fonts once. The build and deployed binary hashes identify this implementation.
