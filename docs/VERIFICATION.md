# Frontend verification — 6 November 2026

| Check                     | Observed result                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`                | 38 tests across 8 files passed.                                                                                                            |
| `npm run test:e2e`        | 34 browser tests passed.                                                                                                                   |
| Route accessibility       | Zero axe violations on the tested mock routes at 1440×900 and 390×844. Unconfigured testnet routes and purchase dialogs also passed.       |
| Browser errors            | Zero console errors/page exceptions in the route checks and production smoke test.                                                         |
| Keyboard                  | Dialog Tab cycling, Escape and focus restoration passed.                                                                                   |
| Responsive                | No page-level horizontal overflow in the tested route/viewport combinations. Tables and the mobile stepper scroll within their containers. |
| Production build          | TypeScript strict build, Vite build and budget script passed.                                                                              |
| Landing JS                | 68,537 gzip bytes against a 120,000-byte budget.                                                                                           |
| Entire app JS             | 237,059 gzip bytes against a 250,000-byte budget; sum includes all emitted production chunks, wallet/RPC and embedded SVG fonts.           |
| Production purchase       | Mock purchase settled in the built app. No real funds moved.                                                                               |
| Real wallet picker        | Loaded real NEAR Connect testnet manifest, passed axe at both viewport sizes, cancelled without selecting an account or signing.           |
| Real RPC                  | Browser and production-bundle provider returned chain ID `testnet`.                                                                        |
| Public documents/licenses | HTTP 200 for README, threat model, AI disclosure and both font licenses.                                                                   |
| Dev gallery               | Excluded from production manifest.                                                                                                         |

Raw production observations: [production-verification.json](production-verification.json). Reproduce with Vite preview on port 4173 and `node scripts/check-production.mjs`. The build writes its current measurements to `dist/bundle-report.json`. The Playwright report is generated under the ignored `playwright-report/` directory.

These are frontend verification results. No Writ contract deployment, actual settlement/refund transaction, contract audit, sandbox gas/storage benchmark, competitor benchmark or external publication was performed. Real mint/unwrap integration remains disabled; method/ABI activation requirements are documented in [contract-integration.md](contract-integration.md).
