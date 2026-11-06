import type { Writ } from "../chain/types";
import { getTemplate } from "../templates/registry";
import { formatNear, utcDate, writNumber } from "../utils/amounts";
import { svgFontCss } from "./fonts.generated";
export const xmlEscape = (value: string): string =>
  value.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function renderWritSvg(writ: Writ): string {
  const template = getTemplate(writ.templateId);
  const x = xmlEscape;
  const status = writ.status;
  const stubFill =
    status === "listed"
      ? "#FFD400"
      : status === "locked"
        ? "#000000"
        : status === "lent"
          ? "#FFF6CC"
          : "#FFFFFF";
  const stubInk = status === "locked" ? "#FFD400" : "#000000";
  const loan = writ.loans[0];
  const stub =
    status === "listed"
      ? `For sale: ${formatNear(writ.price ?? "0")} NEAR`
      : status === "locked"
        ? "Sale in progress"
        : status === "lent" && loan
          ? `Lent until ${utcDate(loan.expiresAt)}`
          : "Status: Held";
  const stamp =
    status === "listed"
      ? `<g transform="translate(690 689) rotate(-6)"><rect x="-145" y="-49" width="290" height="112" fill="none" stroke="#3D1FE0" stroke-width="3"/><rect x="-137" y="-41" width="274" height="96" fill="none" stroke="#3D1FE0" stroke-width="2"/><text y="0" text-anchor="middle" class="heavy" font-size="48" fill="#3D1FE0">LISTED</text><text y="35" text-anchor="middle" class="typed" font-size="25" fill="#3D1FE0">${x(formatNear(writ.price ?? "0"))} NEAR</text></g>`
      : status === "locked"
        ? '<g transform="translate(690 689) rotate(-4)"><rect x="-149" y="-46" width="298" height="110" fill="none" stroke="#C8160F" stroke-width="3"/><rect x="-141" y="-38" width="282" height="94" fill="none" stroke="#C8160F" stroke-width="2"/><text y="2" text-anchor="middle" class="heavy" font-size="47" fill="#C8160F">IN SALE</text><text y="34" text-anchor="middle" font-size="22" fill="#C8160F">Checks running</text></g>'
        : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" role="img" aria-labelledby="title desc"><title id="title">Writ ${x(writNumber(writ.id))}: ${x(template.name)}</title><desc id="desc">${x(stub)}. Held by ${x(writ.owner)}. Target ${x(writ.target)}.</desc><defs><style>${svgFontCss}\ntext{font-family:'Public Sans',sans-serif}.typed{font-family:'Courier Prime',monospace}.heavy{font-family:'Public Sans',sans-serif;font-weight:900}</style></defs><rect x="1.5" y="1.5" width="997" height="997" fill="#FFFFFF" stroke="#000000" stroke-width="3"/><rect x="3" y="3" width="994" height="112" fill="#000000"/><text x="54" y="74" class="heavy" font-size="39" style="fill:#FFFFFF">Writ ${x(writNumber(writ.id))}</text><text x="948" y="71" text-anchor="end" class="typed" font-size="24" style="fill:#FFFFFF">${x(writ.collection)}</text><text x="57" y="185" font-size="26" style="fill:#4D4D4D">Holds the role</text>${template.roleTitle
    .split("\n")
    .map(
      (line, i) =>
        `<text x="52" y="${302 + i * 108}" class="heavy" font-size="120" letter-spacing="-4">${x(line)}</text>`,
    )
    .join(
      "",
    )}<text x="58" y="475" class="typed" font-size="32">${x(writ.target)}</text><g transform="translate(839 245)"><circle r="87" fill="#FFD400" stroke="#000000" stroke-width="3"/><circle r="73" fill="none" stroke="#000000" stroke-width="3" stroke-dasharray="6 5"/><text text-anchor="middle" y="30" class="heavy" font-size="91">W</text></g><rect x="57" y="527" width="886" height="112" fill="none" stroke="#000000" stroke-width="2"/><path d="M280 527v112M505 527v112" stroke="#000000" stroke-width="2"/>${[
    { label: "Epoch", value: writ.epoch, x: 81 },
    { label: "Nonce", value: writ.nonce, x: 305 },
    {
      label: "Template",
      value: template.id === "contract-owner" ? "Owner v1" : template.name,
      x: 531,
    },
  ]
    .map(
      (cell) =>
        `<text x="${cell.x}" y="564" font-size="22" style="fill:#4D4D4D">${cell.label}</text><text x="${cell.x}" y="608" class="typed" font-size="32">${x(cell.value)}</text>`,
    )
    .join(
      "",
    )}${stamp}<rect x="3" y="806" width="994" height="191" fill="${stubFill}"/><path d="M3 806H997" stroke="#000000" stroke-width="3" stroke-dasharray="12 10"/><text x="57" y="875" font-size="${status === "lent" ? 27 : 35}" font-weight="900" style="fill:${stubInk}">${x(stub)}</text><text x="57" y="931" class="typed" font-size="27" style="fill:${stubInk}">Held by ${x(writ.owner)}</text>${status === "lent" && loan ? `<text x="57" y="971" class="typed" font-size="23">${x(loan.method)}</text>` : ""}</svg>`;
}
export function writMediaDataUri(writ: Writ): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderWritSvg(writ))}`;
}
