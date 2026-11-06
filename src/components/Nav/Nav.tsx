import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Button, ModeLink } from "../Button/Button";
import { Seal } from "../Seal/Seal";
import { useChain } from "../../hooks/useChain";
import s from "./Nav.module.css";
export function Nav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const { session, connect, disconnect, walletBusy, walletError, clearError } =
    useChain();
  return (
    <>
      <header className={s.header}>
        <div className={`${s.inner} appContainer`}>
          <ModeLink to="/" className={s.logo}>
            <Seal small />
            <span>Writ</span>
          </ModeLink>
          <nav
            aria-label="Main navigation"
            className={`${s.links} ${open ? s.open : ""}`}
            id="main-nav"
          >
            {[
              { to: "/market", label: "The market" },
              { to: "/app", label: "My Writs" },
              { to: "/wrap", label: "Wrap a role" },
            ].map((link) => (
              <ModeLink
                key={link.to}
                to={link.to}
                aria-current={pathname === link.to ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </ModeLink>
            ))}
            <ModeLink to="/#how-it-works" onClick={() => setOpen(false)}>
              How it works
            </ModeLink>
          </nav>
          <div className={s.right}>
            <Button
              variant="primary"
              disabled={walletBusy}
              onClick={() => void (session ? disconnect() : connect())}
            >
              {walletBusy
                ? "Connecting…"
                : session
                  ? session.accountId
                  : "Connect wallet"}
            </Button>
            <button
              className={s.menu}
              aria-expanded={open}
              aria-controls="main-nav"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>
      {walletError && (
        <div className={s.error} role="alert">
          <span>{walletError}</span>
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}
    </>
  );
}
