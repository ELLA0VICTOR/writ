import type { CSSProperties } from "react";
import s from "./Stamp.module.css";
export function Stamp({
  word,
  sub,
  tone = "clean",
  rotate = -5,
  size = "normal",
  animate = false,
}: {
  word: string;
  sub?: string;
  tone?: "clean" | "refused" | "listed";
  rotate?: number;
  size?: "small" | "normal" | "large";
  animate?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`${s.stamp} ${s[tone]} ${s[size]} ${animate ? s.animate : ""}`}
      style={{ "--r": `${rotate}deg` } as CSSProperties}
    >
      {word}
      {sub && <span className={s.sub}>{sub}</span>}
    </span>
  );
}
