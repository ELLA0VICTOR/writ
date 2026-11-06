import type { WalletOption } from "../../chain/types";
import { Dialog } from "../Dialog/Dialog";
import { Button } from "../Button/Button";
import s from "./WalletDialog.module.css";
export default function WalletDialog({
  wallets,
  onClose,
  onSelect,
}: {
  wallets: WalletOption[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Dialog title="Connect to NEAR testnet" onClose={onClose}>
      <p className="sectionLabel">Your wallet, your authority</p>
      <h3>Choose your wallet.</h3>
      <p>
        Connection shares your account with Writ. It does not approve a purchase
        or move funds. Your wallet asks you to confirm each transaction.
      </p>
      <div className={s.wallets}>
        {wallets.map((wallet) => (
          <button key={wallet.id} onClick={() => onSelect(wallet.id)}>
            <strong>{wallet.name}</strong>
            <span>
              {wallet.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </span>
          </button>
        ))}
      </div>
      {wallets.length === 0 && (
        <p className="errorText">
          No compatible testnet wallets are available right now. Close this
          dialog and retry.
        </p>
      )}
      <p className={s.note}>
        Wallet discovery and signing use NEAR Connect. Only testnet-compatible
        wallets are shown.
      </p>
      <footer>
        <Button onClick={onClose}>Cancel</Button>
      </footer>
    </Dialog>
  );
}
