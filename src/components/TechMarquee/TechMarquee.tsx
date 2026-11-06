import { useState } from "react";
import s from "./TechMarquee.module.css";

const technologies = [
  { name: "NEAR", logo: "/brands/near.svg" },
  { name: "React", logo: "/brands/react.svg" },
  { name: "TypeScript", logo: "/brands/typescript.svg" },
  { name: "Vite", logo: "/brands/vite.svg" },
];

export function TechMarquee() {
  const [paused, setPaused] = useState(false);
  return (
    <section className={s.section} aria-label="Built with" data-reveal>
      <div className={s.band}>
        <div className={s.track} data-paused={paused}>
          {[0, 1, 2].map((copy) => (
            <ul
              key={copy}
              className={s.group}
              aria-label={copy === 0 ? "Technologies used by Writ" : undefined}
              aria-hidden={copy === 0 ? undefined : true}
            >
              {technologies.map((technology) => (
                <li key={technology.name}>
                  <img src={technology.logo} alt="" width="44" height="40" />
                  <span>{technology.name}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      <div className={`${s.caption} container`}>
        <p>Built with NEAR and tools we trust.</p>
        <button
          type="button"
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? "Resume motion" : "Pause motion"}
        </button>
      </div>
    </section>
  );
}
