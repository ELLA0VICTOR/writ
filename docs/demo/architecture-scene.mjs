// Editable vector artwork for the narration's architecture cutaways.
// It is an illustration, not a recording of transactions or live account state.
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const data = async (path, type) =>
  `data:${type};base64,${(await readFile(new URL(path, root))).toString("base64")}`;
export const stages = [
  {
    id: "sdk",
    label: "Your app can connect through the SDK.",
    detail: "The separate app uses its own wallet connection.",
    nodes: ["sdk", "wallet"],
    edges: ["sdk-wallet"],
    anchor: "Developers can connect their own applications using Writ's SDK",
  },
  {
    id: "holder",
    label: "NEAR checks who holds the NFT.",
    detail:
      "The collection checks the current holder and approved permissions.",
    nodes: ["wallet", "collection"],
    edges: ["wallet-collection"],
    anchor: "Underneath, NEAR smart contracts check the current holder",
  },
  {
    id: "target",
    label: "An approved command reaches the connected app.",
    detail:
      "The executor forwards it; the connected app checks the caller's role.",
    nodes: ["collection", "executor", "target"],
    edges: ["collection-executor", "executor-target"],
    anchor: "before forwarding an approved command",
  },
  {
    id: "executor",
    label: "The executor account has no access keys.",
    detail: "Only Writ's collection can instruct this dedicated account.",
    nodes: ["executor"],
    edges: [],
    anchor: "The account behind the NFT has no access keys.",
  },
  {
    id: "limits",
    label: "Other permissions still matter.",
    detail:
      "The testnet collection keeps an upgrade key. External keys or governance may also change control.",
    nodes: ["upgrade", "target"],
    edges: [],
    anchor: "Separate permissions outside Writ still matter",
  },
];

export async function architectureSvg() {
  const [regular, bold, mono, near, react, ts, vite, writ] = await Promise.all([
    data(
      "node_modules/@fontsource/public-sans/files/public-sans-latin-400-normal.woff2",
      "font/woff2",
    ),
    data(
      "node_modules/@fontsource/public-sans/files/public-sans-latin-800-normal.woff2",
      "font/woff2",
    ),
    data(
      "node_modules/@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff2",
      "font/woff2",
    ),
    ...["near", "react", "typescript", "vite"].map((name) =>
      data(`public/brands/${name}.svg`, "image/svg+xml"),
    ),
    data("public/favicon.svg", "image/svg+xml"),
  ]);
  const label = (x, y, text, cls = "body") =>
    `<text x="${x}" y="${y}" class="${cls}">${text}</text>`;
  const card = (id, x, y, width, height, contents) =>
    `<g data-node="${id}" data-bounds="${x},${y},${width},${height}"><rect class="shadow" x="${x + 6}" y="${y + 6}" width="${width}" height="${height}"/><rect class="box" x="${x}" y="${y}" width="${width}" height="${height}"/>${contents}</g>`;
  const edge = (id, d) =>
    `<g data-edge="${id}"><path class="edge" d="${d}" marker-end="url(#arrow)"/><path class="flow" d="${d}"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" role="img" aria-labelledby="title description">
  <title id="title">How Writ passes control</title><desc id="description">Writ's website or another app using its SDK requests a wallet signature. The NEAR collection contract checks NFT permissions, instructs a keyless executor, and the connected application enforces its own role checks. The collection retains its testnet upgrade key.</desc>
  <defs><style>
    @font-face{font-family:Public;src:url('${regular}')}@font-face{font-family:Public;src:url('${bold}');font-weight:800}@font-face{font-family:Courier;src:url('${mono}')}
    text{font-family:Public,sans-serif;fill:#000}.heading{font-size:64px;font-weight:800;letter-spacing:-2px}.subtitle{font-size:27px;fill:#4d4d4d}.tag{font:19px Courier,monospace}.body{font-size:23px}.small{font-size:20px;fill:#4d4d4d}.cardTitle{font-size:32px;font-weight:800;letter-spacing:-.6px}.miniTitle{font-size:29px;font-weight:800;letter-spacing:-.5px}.caption{font-size:38px;font-weight:800;letter-spacing:-1px}.detail{font-size:23px;fill:#333}.box{fill:#fff;stroke:#000;stroke-width:2.5}.shadow{fill:#000}.edge{fill:none;stroke:#000;stroke-width:3}.flow{fill:none;stroke:#ffd400;stroke-width:5;stroke-dasharray:12 13;visibility:hidden}.active .box{fill:#ffd400;stroke-width:4}.active .flow{visibility:visible}.active .small{fill:#171717}.step{fill:#fff;stroke:#000;stroke-width:2}.step.active{fill:#ffd400}.keyBox{fill:#fff;stroke:#000;stroke-width:2}.active .keyBox{fill:#ffd400;stroke-width:4}
  </style><marker id="arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto"><path d="M1 1 L10 6 L1 11" fill="none" stroke="#000" stroke-width="2"/></marker></defs>
  <rect width="1920" height="1080" fill="#fff"/>
  <image href="${writ}" x="65" y="42" width="44" height="44"/>
  ${label(126, 73, "WRIT / UNDER THE HOOD", "tag")}
  ${label(1850, 72, "ARCHITECTURE ILLUSTRATION", "tag").replace('class="tag"', 'class="tag" text-anchor="end"')}
  ${label(65, 164, "How Writ passes control.", "heading")}
  ${label(66, 210, "The NFT determines who can use the approved actions.", "subtitle")}
  <rect x="780" y="247" width="1070" height="508" fill="#fafafa" stroke="#000" stroke-width="1.5" stroke-dasharray="7 7"/>
  <image href="${near}" x="807" y="265" width="25" height="25"/>
  ${label(845, 287, "NEAR TESTNET", "tag")}${label(1822, 287, "Rust / near-sdk", "tag").replace('class="tag"', 'class="tag" text-anchor="end"')}
  ${edge("app-wallet", "M395 375 H438 V450 H465")}
  ${edge("sdk-wallet", "M395 580 H438 V550 H465")}
  ${edge("wallet-collection", "M720 500 H795")}
  ${edge("collection-executor", "M1195 470 H1249 V413 H1300")}
  ${edge("executor-target", "M1542 490 V550")}
  ${card("app", 65, 300, 330, 150, `${label(88, 334, "WRIT WEBSITE", "tag")}${label(88, 379, "Use the Writ app", "miniTitle")}${label(88, 416, "React + TypeScript + Vite", "small")}`)}
  ${card("sdk", 65, 505, 330, 150, `${label(88, 539, "ANOTHER APPLICATION", "tag")}${label(88, 584, "Use the Writ SDK", "miniTitle")}${label(88, 621, "Its own wallet connection", "small")}`)}
  ${card("wallet", 475, 390, 245, 220, `${label(500, 426, "NEAR CONNECT", "tag")}${label(500, 477, "Your wallet", "miniTitle")}<path d="M502 505 H681 V560 H502 Z M649 521 H681 V546 H649 Z" fill="none" stroke="#000" stroke-width="3"/><circle cx="659" cy="533" r="3" fill="#000"/>${label(500, 590, "Signs the request", "small")}`)}
  ${card("collection", 805, 375, 390, 262, `${label(829, 410, "NEAR COLLECTION CONTRACT", "tag")}${label(829, 458, "Writ's rules", "cardTitle")}${label(829, 494, "Checks the current holder", "body")}<rect x="829" y="514" width="342" height="51" fill="#fff" stroke="#000" stroke-width="1.5"/><image href="${writ}" x="841" y="523" width="32" height="32"/>${label(886, 548, "NFT holder + loans", "tag")}${label(829, 604, "Loans, transfers + settlement", "small")}`)}
  <g data-node="upgrade" data-bounds="884,311,332,43"><path d="M1061 354 V371" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="4 4"/><rect class="keyBox" x="884" y="311" width="332" height="43"/>${label(900, 339, "Upgrade key retained", "tag")}</g>
  ${card("executor", 1310, 334, 465, 156, `${label(1335, 369, "DEDICATED EXECUTOR", "tag")}${label(1335, 414, "Account with no keys", "cardTitle")}${label(1335, 451, "Forwards only approved commands", "small")}`)}
  ${card("target", 1310, 560, 465, 157, `${label(1335, 594, "EXTERNAL ROLE", "tag")}${label(1335, 639, "Connected application", "cardTitle")}${label(1335, 676, "Enforces its own permission checks", "small")}`)}
  ${label(805, 727, "The role stays with the executor on NFT transfer.", "small")}
  <line x1="65" y1="786" x2="1850" y2="786" stroke="#000" stroke-width="2"/>
  <rect x="65" y="819" width="13" height="39" fill="#ffd400"/>
  <text id="stage-label" x="96" y="850" class="caption">The NFT holder controls the approved actions.</text>
  <text id="stage-detail" x="96" y="892" class="detail">A website or another integrated app can request them through the holder's wallet.</text>
  <g id="steps">${stages.map((s, i) => `<rect data-step="${s.id}" x="${1645 + i * 42}" y="912" width="26" height="8" class="step"/>`).join("")}</g>
  <line x1="65" y1="950" x2="1850" y2="950" stroke="#000" stroke-width="1"/>
  <image href="${near}" x="67" y="982" width="32" height="32"/>${label(112, 1007, "NEAR", "tag")}
  <image href="${react}" x="231" y="982" width="32" height="32"/>${label(277, 1007, "React", "tag")}
  <image href="${ts}" x="406" y="982" width="32" height="32"/>${label(452, 1007, "TypeScript", "tag")}
  <image href="${vite}" x="641" y="982" width="32" height="32"/>${label(687, 1007, "Vite", "tag")}
  ${label(799, 1007, "Rust + near-sdk", "tag")}
  ${label(1850, 1006, "Signing / command path · Read-only RPC calls omitted", "small").replace('class="small"', 'class="small" text-anchor="end"')}
  </svg>`;
}

export async function architectureHtml() {
  const svg = await architectureSvg();
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Writ architecture preview</title><style>html,body{margin:0;background:white;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${svg}<script>
  const stages = ${JSON.stringify(stages)};
  window.renderAt = function(seconds, forcedStage) {
    const index = Math.min(stages.length - 1, Math.max(0, Math.floor(seconds / 4)));
    const step = forcedStage === 'overview' ? null : stages.find(s => s.id === forcedStage) || stages[index];
    document.querySelectorAll('[data-node],[data-edge],[data-step]').forEach(n => n.classList.remove('active'));
    if(step){
      step.nodes.forEach(id => document.querySelector('[data-node="'+id+'"]').classList.add('active'));
      step.edges.forEach(id => document.querySelector('[data-edge="'+id+'"]').classList.add('active'));
      document.querySelector('[data-step="'+step.id+'"]').classList.add('active');
    }
    document.getElementById('stage-label').textContent = step?.label || 'The NFT holder controls the approved actions.';
    document.getElementById('stage-detail').textContent = step?.detail || 'A website or another integrated app can request them through the holder’s wallet.';
    document.querySelectorAll('.flow').forEach(n => n.style.strokeDashoffset = String(-seconds * 40));
    window.currentStage = step?.id || 'overview';
  };
  const params = new URLSearchParams(location.search);
  if(params.has('stage')) window.renderAt(0, params.get('stage'));
  else if(params.has('t')) window.renderAt(Number(params.get('t')) || 0);
  else { let started = performance.now(); const draw = now => {window.renderAt(((now-started)/1000)%20);requestAnimationFrame(draw)};requestAnimationFrame(draw); }
  </script></html>`;
}
