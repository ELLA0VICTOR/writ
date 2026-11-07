import { createContext } from "react";
import type { WritAdapter } from "./adapter";
import type { WalletSession } from "./types";
import type { DeploymentConfig } from "./deployment";
interface ChainContext {
  mode: "mock" | "testnet" | "mainnet";
  deployment: DeploymentConfig;
  selectDeployment: (config: DeploymentConfig | null) => Promise<void>;
  requestPending: boolean;
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
