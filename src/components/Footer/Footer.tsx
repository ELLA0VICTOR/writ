import { ModeLink } from "../Button/Button";
import { Seal } from "../Seal/Seal";
import s from "./Footer.module.css";
export function Footer() {
  const github = import.meta.env.VITE_GITHUB_URL as string | undefined;
  const video = import.meta.env.VITE_DEMO_VIDEO_URL as string | undefined;
  return (
    <footer className={s.footer}>
      <div className={`${s.inner} container`}>
        <div>
          <ModeLink to="/" className={s.logo}>
            <Seal small />
            <strong>Writ</strong>
          </ModeLink>
          <p>On-chain authority, handed over.</p>
          <small>Built for NEAR HACKATHON 2026.</small>
        </div>
        <nav aria-label="Project resources">
          {github && (
            <a href={github} target="_blank" rel="noreferrer">
              GitHub
            </a>
          )}
          <a href="/docs/README.md">README</a>
          <a href="/docs/THREAT_MODEL.md">Threat model</a>
          <a href="/docs/INTEGRATION_GUIDE.md">Developer integration</a>
          <a href="/docs/contract-verification.json">Contract test evidence</a>
          {video && (
            <a href={video} target="_blank" rel="noreferrer">
              Demo video
            </a>
          )}
          <a href="/docs/AI_USE.md">AI-use disclosure</a>
        </nav>
      </div>
    </footer>
  );
}
