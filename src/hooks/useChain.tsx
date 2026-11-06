import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  lazy,
  Suspense,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import type { WritAdapter } from "../chain/adapter";
import type { WalletSession, WalletOption } from "../chain/types";
import { messageOf } from "../chain/errors";
import { Context } from "../chain/context";
const adapters = new Map<string, Promise<WritAdapter>>();
const WalletDialog = lazy(
  () => import("../components/WalletDialog/WalletDialog"),
);
export function ChainProvider({ children }: { children: ReactNode }) {
  const { search } = useLocation();
  const mode: "mock" | "testnet" =
    new URLSearchParams(search).get("mock") === "1" ? "mock" : "testnet";
  const [session, setSession] = useState<WalletSession | null>(null);
  const [walletBusy, setBusy] = useState(false);
  const [walletError, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [walletOptions, setWalletOptions] = useState<WalletOption[] | null>(
    null,
  );
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const getAdapter = useCallback(() => {
    let adapter = adapters.get(mode);
    if (!adapter) {
      adapter =
        mode === "mock"
          ? import("../chain/mockAdapter").then((m) => m.createMockAdapter())
          : import("../chain/testnetAdapter").then((m) =>
              m.createTestnetAdapter(),
            );
      adapters.set(mode, adapter);
    }
    return adapter;
  }, [mode]);
  const refreshSession = useCallback(async () => {
    const value = await (await getAdapter()).getSession();
    if (modeRef.current === mode) setSession(value);
  }, [getAdapter, mode]);
  useEffect(() => {
    setSession(null);
    setError("");
    setWalletOptions(null);
    setBusy(false);
    const listener = () => void refreshSession().catch(() => setSession(null));
    listener();
    window.addEventListener("writ:wallet", listener);
    return () => window.removeEventListener("writ:wallet", listener);
  }, [refreshSession]);
  const connect = useCallback(
    async (accountId?: string) => {
      setBusy(true);
      setError("");
      try {
        const adapter = await getAdapter();
        if (mode === "testnet" && !accountId) {
          const options = await adapter.getWalletOptions();
          if (modeRef.current === mode) setWalletOptions(options);
          return;
        }
        const result = await adapter.connect(accountId);
        if (modeRef.current !== mode) return;
        setSession(result);
        setRevision((r) => r + 1);
      } catch (error) {
        setError(messageOf(error));
      } finally {
        if (modeRef.current === mode) setBusy(false);
      }
    },
    [getAdapter, mode],
  );
  const disconnect = useCallback(async () => {
    try {
      await (await getAdapter()).disconnect();
      setSession(null);
      setRevision((r) => r + 1);
    } catch (error) {
      setError(messageOf(error));
    }
  }, [getAdapter]);
  const value = useMemo(
    () => ({
      mode,
      session,
      getAdapter,
      connect,
      disconnect,
      refreshSession,
      walletBusy,
      walletError,
      clearError: () => setError(""),
      revision,
      changed: () => setRevision((r) => r + 1),
    }),
    [
      mode,
      session,
      getAdapter,
      connect,
      disconnect,
      refreshSession,
      walletBusy,
      walletError,
      revision,
    ],
  );
  return (
    <Context.Provider value={value}>
      {children}
      {walletOptions && (
        <Suspense fallback={<p role="status">Opening wallet choices…</p>}>
          <WalletDialog
            wallets={walletOptions}
            onClose={() => setWalletOptions(null)}
            onSelect={(id) => {
              setWalletOptions(null);
              void connect(id);
            }}
          />
        </Suspense>
      )}
    </Context.Provider>
  );
}
export function useChain() {
  const context = useContext(Context);
  if (!context) throw new Error("Missing Writ context.");
  return context;
}
export function useAdapter() {
  const { getAdapter, mode } = useChain();
  const [loaded, setLoaded] = useState<{
    mode: string;
    adapter: WritAdapter;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void getAdapter().then((value) => {
      if (active) setLoaded({ mode, adapter: value });
    });
    return () => {
      active = false;
    };
  }, [getAdapter, mode]);
  return loaded?.mode === mode ? loaded.adapter : null;
}
export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — Writ`;
  }, [title]);
}
