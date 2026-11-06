import { createContext } from "react";
import type { WritAdapter } from "./adapter";
import type { WalletSession } from "./types";
interface ChainContext {
  mode: "mock" | "testnet";
  session: WalletSession | null;
  getAdapter: () => Promise<WritAdapter>;
  connect: (accountId?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshSession: () => Promise<void>;
  walletBusy: boolean;
  walletError: string;
  clearError: () => void;
  revision: number;
  changed: () => void;
}
export const Context = createContext<ChainContext | null>(null);
