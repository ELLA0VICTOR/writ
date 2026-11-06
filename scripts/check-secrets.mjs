import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const staged = process.argv.includes("--staged");
function git(args) {
  return execFileSync("git", args, { maxBuffer: 32 * 1024 * 1024 });
}
const files = [
  ...new Set(
    git(
      staged
        ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]
        : ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    )
      .toString("utf8")
      .split("\0")
      .filter(Boolean),
  ),
];

const excluded =
  /(^|\/)(node_modules|dist|dist-ssr|target|artifacts|\.local|test-results|playwright-report|coverage|\.near-credentials|\.aws|\.secrets|secrets|credentials|\.vercel|\.netlify)(\/|$)|^integration\/results\/|(^|\/)\.env(?:\..*)?$|\.(pem|key|p12|pfx|keystore|jks|seed|log|tsbuildinfo)$/i;
const generated =
  /^(public\/(docs|sdk|fonts\/licenses)\/|examples\/external-app\/public\/deployment\.json$|docs\/screenshots\/|src\/nft\/fonts\.generated\.ts$|docs\/production-verification\.json$|writ-frontend-codex-prompt\.md$)/;
const patterns = [
  ["private key block", /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/g],
  [
    "NEAR private key",
    /ed25519:[1-9A-HJ-NP-Za-km-z]{80,90}(?![1-9A-HJ-NP-Za-km-z])/g,
  ],
  [
    "GitHub token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g,
  ],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  [
    "service token",
    /\b(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}|xox[baprs]-[A-Za-z0-9-]{24,})\b/g,
  ],
  [
    "credential assignment",
    /\b(?:PRIVATE_KEY|SECRET_KEY|API_KEY|ACCESS_TOKEN|AUTH_TOKEN|PASSWORD|MNEMONIC|SEED_PHRASE)\b["']?\s*[:=]\s*["']([^"'\r\n]{8,})["']/gi,
  ],
];
const findings = [];
let scanned = 0;
for (const file of files) {
  const example = /(^|\/)\.env\.example$/.test(file);
  if ((!example && excluded.test(file)) || generated.test(file)) {
    findings.push(`${file}: excluded credential/generated file`);
    continue;
  }
  if (!staged && !existsSync(file)) continue;
  const bytes = staged ? git(["show", `:${file}`]) : readFileSync(file);
  if (bytes.includes(0)) continue;
  const content = bytes.toString("utf8");
  scanned++;
  for (const [label, pattern] of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      if (
        label === "credential assignment" &&
        /^(?:your[_-]|example|placeholder|<|\$\{|process\.env\.)/i.test(
          match[1],
        )
      )
        continue;
      const line = content.slice(0, match.index).split("\n").length;
      findings.push(`${file}:${line}: possible ${label}`);
    }
  }
}
if (findings.length) {
  console.error(
    "Commit safety check failed. Values are deliberately not printed:",
  );
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${scanned} ${staged ? "staged" : "commit-candidate"} text files: no matching secret patterns or excluded files found.`,
  );
}
