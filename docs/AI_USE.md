# Libraries and AI use

The user supplied idea-selection material and the frontend brief. Claude contributed the Writ proposal/frontend direction. OpenAI Codex implemented and revised the frontend, Rust collection/executor/factory, adapters, sandbox and browser tests, deployment scripts, docs and SVG media generation.

Direct tools/libraries: React, React DOM, React Router DOM, Vite, its React plugin, TypeScript, Fontsource Public Sans/Courier Prime, NEAR Connect, near-api-js, Vitest, Playwright, axe-core's Playwright integration, Prettier, and the starter's optional Oxlint. The backend also uses near-sdk 5.30.1, near-sdk-contract-tools 4.0.0, cargo-near 0.23.0, near-sandbox 0.3.5 and an unchanged pinned upstream Sputnik DAO Wasm. Exact dependencies/provenance are recorded in npm/Cargo lockfiles and vendor-provenance.json. No UI kit, Tailwind or CSS-in-JS runtime.

The Sites skill's local preview/validation workflow was consulted. The project uses the requested Vite repository and Vercel/Netlify static configuration; Sites hosting was not used.

Public NEAR documentation informed integration. No competitor implementation was copied. Fonts retain their SIL Open Font Licenses. Actual Wasm/receipt tests, browser checks and public testnet deployment receipts are documented separately. None establishes an independent audit, exhaustive financial security or competitive superiority. The organizer?s near-smart-contracts agent guide was used for scaffolding and the contract workflow.
