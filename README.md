# Writ

Transfer a contract role with an NFT. Inspect its declared conditions before buying it.

React 18, strict TypeScript and Vite. Static frontend for the NEAR hackathon NFT track, following `writ-frontend-codex-prompt.md`.

**Status:** interactive frontend with a stateful mock adapter, real NEAR wallet/RPC integration and a gated, proposed contract ABI. This repository does not deploy a collection or executor. Minting and unwrapping remain disabled in testnet mode until their provisioning quote and verified hand-back integrations exist. Frontend tests are not contract security tests.

## Run and explore

Use Node 24.19+ (the NEAR package also supports Node 22.22.2+).

```sh
npm ci
npm run dev
```

Open `http://localhost:5173/?mock=1`. The example banner stays visible on every mock page. No wallet signs anything and no NEAR moves in example mode. Internal links preserve the flag.

1. The landing page introduces transferable role authority and shows the technology strip. **Wrap a role** is the primary action; sales remain optional. Its previous purchase exercise is available only in the development component gallery.
2. Open `/market?mock=1`, inspect Writ 0007 and read the checks without connecting. Key/code checks are explicitly page-only observations.
3. Select **Ben, buyer** in **Example viewer**. Buy Writ 0007 with conditions. The holder changes to Ben and his holder actions become available.
4. Reset examples. Use **Example purchase controls** on the Writ page to choose **Hidden next owner**. The purchase is refused and the refund becomes claimable. Withdraw it to see the returned-funds example. There are no invented testnet links.
5. Try rejected signatures, changed versions, competing buyers, insufficient balance, unconfirmed outcomes and overdue callbacks. An unconfirmed attempt offers a status check instead of another payment. Timeout release precedes refund withdrawal.
6. Select **Ada, holder**, then inspect Writ 0012 through **My Writs**. Use a role, lend exact `set_price` arguments with a future UTC expiry, or list it. Listed Writs pause holder actions. End loans before unwrapping.
7. On `/wrap?mock=1` as Ada, choose Contract owner and enter `lanterns-nft.testnet`. Read the owner, mint, propose the executor, accept from it, and verify. Enter `other.testnet` to see a mismatched holder.
8. `/__gallery?mock=1` shows component/NFT states in development. Its route and source chunk are omitted from production.

Fixtures are authored examples dated 6 November 2026. **Reset examples** clears in-memory state and mock purchase recovery entries. A hard reload resets the mock chain; real purchase identifiers use separate session-storage entries.

## Testnet integration

Without the flag, `testnetAdapter` uses real wallets and public RPC. Missing configuration shows a deployment-pending sheet. RPC errors never fall back to fixtures.

Copy `.env.example` to `.env.local`:

| Variable                   | Purpose                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `VITE_NEAR_RPC_URL`        | Defaults to `https://rpc.testnet.near.org`.                |
| `VITE_WRIT_CONTRACT`       | Actual collection account. Leave empty until deployed.     |
| `VITE_WRIT_ABI_VERSION`    | `writ-ui-v1`, after implementing the integration contract. |
| `VITE_EXECUTOR_CODE_HASH`  | Independently published executor hash.                     |
| `VITE_OWNER_TEMPLATE_HASH` | Published hash for the exact owner template.               |
| `VITE_GITHUB_URL`          | Real repository link; hidden when absent.                  |
| `VITE_DEMO_VIDEO_URL`      | Real demo link; hidden when absent.                        |

All `VITE_` values are public. Do not put signing keys or secrets in them. The adapter verifies `get_frontend_config` against the configured ABI and hashes. Setting environment values alone does not establish deployment compatibility.

See [contract integration](docs/contract-integration.md) for proposed methods, JSON shapes, money semantics and remaining work. After connecting a compatible deployment, restart Vite and open `/writ/<actual-id>`. **Read again** runs the page checks at one finalized block hash. A purchase runs its own asynchronous settlement checks.

No indexer is configured; history uses the contract history view. `src/content/evidence.json` has no transaction hashes. Every gate in `template-validation.json` starts false. Only genuine sandbox evidence should change them. DAO and staking drafts are consequently not promoted as supported integrations.

## Checks and build

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

Vitest covers replay outcomes, check mapping, integer precision, untrusted RPC data, mock permission behavior, purchase transitions and four SVG snapshots. Playwright covers routes, responsive overflow, console errors, axe, purchase/refund/recovery states, keyboard focus and wrapping. Automated accessibility checks supplement browser/keyboard inspection.

Screenshots are saved to [docs/screenshots](docs/screenshots) at 1440×900 and 390×844, including purchase receipts. The build enforces 120,000 gzipped JS bytes for landing and 250,000 for the **sum of all production JS chunks**, including wallet, RPC and embedded NFT fonts. See `dist/bundle-report.json`. Vite reports CSS/fonts separately.

`node scripts/inspect-browser.mjs` checks layout and an actual browser RPC connection while Vite is running. It uses development module URLs, not production endpoints.

`node scripts/inspect-wallet.mjs` checks the actual testnet wallet manifest, Writ's own wallet picker and its accessibility at both screenshot sizes. It does not select a wallet or sign anything. The picker uses Writ's flat white/yellow dialog; NEAR Connect handles discovery and signing underneath.

## Static hosting

Vercel or Netlify: build command `npm run build`, output `dist`. `vercel.json` and `public/_redirects` support direct SPA routes. Configure public environment values before building. No external hosting was registered or published during this work.

## Design and boundaries

See [brief resolutions](docs/BRIEF_RESOLUTIONS.md), [threat model](docs/THREAT_MODEL.md) and [NFT media specification](docs/NFT_MEDIA.md). The original brief is unchanged. Design PNGs were not present, so matching unseen canvas exports is not claimed; the written specification governs the build.

Plain CSS custom properties and component CSS Modules implement the theme. Fontsource fonts use `font-display: swap`. Measured Arial/Courier New fallback overrides are reproducible with `python scripts/font-metrics.py` on Windows, without Python dependencies. Platform-specific font loading can still affect layout.

## Libraries and AI use

| Library/tool                           | Use                                           |
| -------------------------------------- | --------------------------------------------- |
| React 18 / React DOM                   | UI and contexts.                              |
| React Router DOM                       | Routing.                                      |
| Vite / React plugin                    | Development and static build.                 |
| TypeScript                             | Strict types.                                 |
| Fontsource Public Sans / Courier Prime | Self-hosted fonts and standalone SVG subsets. |
| `@hot-labs/near-connect`               | Lazy wallet selection/signing.                |
| `near-api-js`                          | Lazy RPC provider.                            |
| Vitest                                 | Unit/snapshot tests.                          |
| Playwright                             | Browser flows, keyboard and screenshots.      |
| `@axe-core/playwright` / axe-core      | Accessibility checks.                         |
| Oxlint                                 | Existing optional lint command.               |
| Prettier                               | Source formatting.                            |

NEAR's [wallet-login guide](https://docs.near.org/web3-apps/tutorials/wallet-login) recommends NEAR Connect with near-api-js. The [RPC documentation](https://docs.near.org/api/rpc/contracts) defines account/key/code queries; [cross-contract docs](https://docs.near.org/smart-contracts/anatomy/crosscontract) explain asynchronous settlement. Checked 6 November 2026.

The user supplied the brief; Claude supplied the Writ proposal/frontend direction. OpenAI Codex generated and revised frontend code, tests, docs and SVG layout. The Sites skill's local-preview/validation workflow was used; its hosting services were not. See [AI-use disclosure](docs/AI_USE.md). Versions/transitive dependencies are recorded in package-lock.json. Fonts retain their included SIL Open Font Licenses. Project source is MIT licensed. No competitor implementation was copied.

## Local Git safety

The local repository uses `.githooks/pre-commit` to scan the **staged content** for common credential patterns and reject generated/private file paths. Activate the hook on a new clone with `git config core.hooksPath .githooks`. Run `npm run check:secrets` to inspect current commit candidates without staging anything. Pattern checks are a safeguard, not a guarantee that every possible secret format is detectable; review staged changes before committing.

Environment files, private-key formats, dependencies, builds, browser reports, local screenshots, copied public docs/licenses, generated SVG font data and the local build brief are excluded. `.env.example`, package-lock.json, source assets, tests and SVG snapshots stay eligible. Font data is regenerated automatically before dev, build and test, so a clean checkout does not need the generated font file committed.

Content uses one-time scroll reveals with a short stagger. Reduced-motion, keyboard-focus and print views remain immediately readable.
