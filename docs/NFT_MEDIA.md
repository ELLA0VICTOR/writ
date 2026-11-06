# NFT metadata-image reference

`src/nft/renderWritSvg.ts` exports `renderWritSvg(writ): string` and `writMediaDataUri(writ): string`. The pure renderer produces standalone 1000×1000 SVGs with accessible title/description and embedded Fontsource Latin WOFF/WOFF2 subsets, choosing the smaller file for each face. Role display text, stamps and the seal use Public Sans 900. Dynamic text is XML escaped.

Held: white stub. Listed: yellow stub, violet LISTED stamp/price. Locked: black/yellow stub, red IN SALE stamp. Lent: pale-yellow stub, UTC expiry/method. Marketplace and public-record images use this generator.

`npm run fonts:svg` regenerates the embedded fonts after dependency updates. Licenses are copied to `public/fonts/licenses`. SVGs do not require remote fonts.

The contract team must implement equivalent rendering/media delivery for NEP-177; TypeScript cannot execute inside a Rust contract. A URI created only at mint will not update on later prices/transfers/loans. Choose dynamic metadata views or an explicitly refreshed mechanism and measure response/storage costs before embedding fonts on chain.

This generator and its four normalized snapshots are a reference specification, not a claim that a deployed NFT contract already serves the images.
