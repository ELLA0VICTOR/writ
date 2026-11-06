import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { useChain } from "../../hooks/useChain";
import s from "./Button.module.css";
type Variant = "primary" | "secondary" | "dark";
export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`${s.button} ${s[variant]} ${className}`}
      {...props}
    />
  );
}
export function ModeLink({
  to,
  children,
  ...props
}: Omit<LinkProps, "to"> & { to: string; children?: ReactNode }) {
  const { mode } = useChain();
  const [path, hash] = to.split("#");
  const destination =
    mode === "mock" && !path.includes("?")
      ? `${path}?mock=1${hash ? `#${hash}` : ""}`
      : to;
  return (
    <Link to={destination} {...props}>
      {children}
    </Link>
  );
}
export function ButtonLink({
  variant = "secondary",
  className = "",
  ...props
}: Omit<LinkProps, "to"> & { to: string; variant?: Variant }) {
  return (
    <ModeLink className={`${s.button} ${s[variant]} ${className}`} {...props} />
  );
}
