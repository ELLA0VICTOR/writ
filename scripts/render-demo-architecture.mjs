// Local video artwork only. No wallet connection, RPC calls or hosted app changes.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "@playwright/test";
import { architectureHtml, stages } from "../docs/demo/architecture-scene.mjs";

const output = resolve(".local/demo-architecture");
await mkdir(output, { recursive: true });
const html = await architectureHtml();
await writeFile(resolve(output, "preview.html"), html);
await writeFile(
  resolve(output, "timing.json"),
  JSON.stringify(
    {
      previewOnly: true,
      resolution: [1920, 1080],
      fps: 30,
      note: "Placeholder timings. Match the original ElevenLabs audio before the final edit. SDK appears before the hand-back scene; the later contract explanation is a separate cutaway.",
      cues: stages.map((stage, i) => ({
        ...stage,
        previewStart: i * 4,
        previewEnd: (i + 1) * 4,
      })),
    },
    null,
    2,
  ),
);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Stop the preview's animation loop for deterministic screenshots.
    window.requestAnimationFrame = () => 0;
  });
  await page.waitForTimeout(50);
  const report = {
    resolution: [1920, 1080],
    stages: [],
    textIssues: [],
    brokenImages: [],
  };
  report.brokenImages = await page.evaluate(async () => {
    const failures = [];
    for (const [index, source] of [
      ...document.querySelectorAll("svg image"),
    ].entries()) {
      const img = new Image();
      img.src = source.getAttribute("href");
      try {
        await img.decode();
      } catch {
        failures.push(index);
      }
    }
    return failures;
  });
  if (report.brokenImages.length)
    throw new Error("An embedded technology mark did not load.");
  for (const [index, stage] of [{ id: "overview" }, ...stages].entries()) {
    await page.evaluate((id) => window.renderAt(0, id), stage.id);
    const issues = await page.evaluate(() => {
      const issues = [];
      for (const el of document.querySelectorAll("svg text")) {
        const b = el.getBBox();
        if (b.x < 0 || b.y < 0 || b.x + b.width > 1920 || b.y + b.height > 1080)
          issues.push({ text: el.textContent, kind: "outside frame" });
        const parent = el.closest("[data-bounds]");
        if (parent) {
          const [x, y, w, h] = parent.dataset.bounds.split(",").map(Number);
          if (
            b.x < x + 12 ||
            b.y < y + 8 ||
            b.x + b.width > x + w - 12 ||
            b.y + b.height > y + h - 8
          )
            issues.push({
              text: el.textContent,
              kind: "outside card",
              node: parent.dataset.node,
            });
        }
      }
      return issues;
    });
    report.textIssues.push(
      ...issues.map((issue) => ({ stage: stage.id, ...issue })),
    );
    if (issues.length) throw new Error(JSON.stringify(issues));
    const name =
      stage.id === "overview"
        ? "Writ-architecture.png"
        : `${index}-${stage.id}.png`;
    await page.screenshot({ path: resolve(output, name) });
    report.stages.push({ id: stage.id, image: name });
  }
  await page.evaluate(() => window.renderAt(0, "overview"));
  await writeFile(
    resolve(output, "Writ-architecture.svg"),
    await page
      .locator("svg")
      .first()
      .evaluate((el) => new XMLSerializer().serializeToString(el)),
  );
  await writeFile(
    resolve(output, "verification.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    `Rendered ${report.stages.length} architecture states; no text outside cards or frame.`,
  );
  if (process.argv.includes("--video")) {
    const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
    const encoder = spawn(
      ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "image2pipe",
        "-framerate",
        "30",
        "-vcodec",
        "mjpeg",
        "-i",
        "pipe:0",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-threads",
        "4",
        "-movflags",
        "+faststart",
        resolve(output, "Writ-architecture-preview.mp4"),
      ],
      { windowsHide: true, stdio: ["pipe", "ignore", "pipe"] },
    );
    let errors = "";
    encoder.stderr.on("data", (chunk) => {
      errors += chunk.toString();
    });
    const completion = new Promise((resolve, reject) => {
      encoder.on("error", reject);
      encoder.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(errors.slice(-3000))),
      );
    });
    // Attach a handler immediately if the encoder exits before frame capture finishes.
    void completion.catch(() => undefined);
    for (let frame = 0; frame < 600; frame++) {
      await page.evaluate((t) => window.renderAt(t), frame / 30);
      const jpeg = await page.screenshot({ type: "jpeg", quality: 93 });
      if (!encoder.stdin.write(jpeg)) await once(encoder.stdin, "drain");
      if (frame % 150 === 0) console.log(`Preview: ${frame / 30}s / 20s`);
    }
    encoder.stdin.end();
    await completion;
    console.log(
      "Rendered 20-second silent architecture preview. Final timing awaits the narration audio.",
    );
  }
} finally {
  await browser.close();
}
