# NFT metadata-image reference

`src/nft/renderWritSvg.ts` exports `renderWritSvg(writ): string` and `writMediaDataUri(writ): string`. The pure renderer produces standalone 1000×1000 SVGs with accessible title/description and embedded Fontsource Latin WOFF/WOFF2 subsets, choosing the smaller file for each face. Role display text, stamps and the seal use Public Sans 900. Dynamic text is XML escaped.

Held: white stub. Listed: yellow stub, violet LISTED stamp/price. Locked: black/yellow stub, red IN SALE stamp. Lent: pale-yellow stub, UTC expiry/method. Marketplace and public-record images use this generator.

`npm run fonts:svg` regenerates the embedded fonts after dependency updates. Licenses are copied to `public/fonts/licenses`. SVGs do not require remote fonts.

`scripts/build-contract-media.mjs` compiles 20 lightweight status templates for five profiles from this frontend renderer, plus one shared embedded font subset. `contracts/collection/src/media.rs` fills bounded dynamic values and `nft_token` returns a base64 standalone SVG data URI and a base64 SHA-256 `media_hash` of its decoded bytes. Nothing is frozen at mint: holder, epoch, nonce, price and loans are read from current state. The media hash changes with those bytes. Long protocol account labels receive a bounded text width. Wallets and marketplaces can cache earlier metadata or not index a testnet collection; the on-chain ownership record remains authoritative.

The sandbox core test reads actual Wasm-generated metadata before/after transfer, checks embedded fonts and current holder, and rejects unresolved template markers. Source snapshots remain the frontend reference. Media bytes increase view responses, not per-token storage; account code stores the shared templates/fonts once. The build and deployed binary hashes identify this implementation.
