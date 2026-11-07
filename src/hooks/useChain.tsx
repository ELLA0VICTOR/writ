import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  lazy,
  Suspense,
  Fragment,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { WritAdapter } from "../chain/adapter";
import type { WalletSession, WalletOption } from "../chain/types";
import { messageOf } from "../chain/errors";
import { Context } from "../chain/context";
import {
  deploymentConfig,
  deploymentKey,
  loadDeployment,
  saveDeployment,
  type DeploymentConfig,
} from "../chain/deployment";
const WalletDialog = lazy(
  () => import("../components/WalletDialog/WalletDialog"),
);
export function ChainProvider({ children }: { children: ReactNode }) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const [deployment, setDeployment] = useState(loadDeployment);
  const [generation, setGeneration] = useState(0);
  const [requestPending, setRequestPending] = useState(false);
  const mode: "mock" | "testnet" | "mainnet" =
    new URLSearchParams(search).get("mock") === "1"
      ? "mock"
      : deployment.network;
  const identity = `${mode}:${deploymentKey(deployment)}:${generation}`;
  const [session, setSession] = useState<WalletSession | null>(null);
  const [walletBusy, setBusy] = useState(false);
  const [walletError, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [walletOptions, setWalletOptions] = useState<WalletOption[] | null>(
    null,
  );
  const modeRef = useRef(identity);
  modeRef.current = identity;
  const getAdapter = useMemo(() => {
    let adapter: Promise<WritAdapter> | undefined;
    return () =>
      (adapter ??=
        mode === "mock"
          ? import("../chain/mockAdapter").then((m) => m.createMockAdapter())
          : import("../chain/testnetAdapter").then((m) =>
              m.createTestnetAdapter(
                deployment,
                () => modeRef.current === identity,
              ),
            ));
  }, [mode, deployment, identity]);
  const refreshSession = useCallback(async () => {
    const value = await (await getAdapter()).getSession();
    if (modeRef.current === identity) setSession(value);
  }, [getAdapter, identity]);
  useEffect(() => {
    setSession(null);
    setError("");
    setWalletOptions(null);
    setBusy(false);
    const listener = () =>
      void refreshSession().catch(() => {
        if (modeRef.current === identity) setSession(null);
      });
    listener();
    window.addEventListener("writ:wallet", listener);
    return () => window.removeEventListener("writ:wallet", listener);
  }, [refreshSession, identity]);
  useEffect(() => {
    const listener = () =>
      void import("../chain/wallet").then((m) =>
        setRequestPending(m.walletRequestPending()),
      );
    window.addEventListener("writ:wallet-request", listener);
    return () => window.removeEventListener("writ:wallet-request", listener);
  }, []);
  const selectDeployment = useCallback(
    async (config: DeploymentConfig | null) => {
      const wallet = await import("../chain/wallet");
      if (walletBusy || wallet.walletRequestPending())
        throw new Error(
          "Finish the pending wallet request before changing the network.",
        );
      saveDeployment(config);
      const next = config ?? deploymentConfig();
      // Immediately invalidate preflights, including a switch away and back to the same deployment.
      modeRef.current = "switching";
      wallet.rememberWallet(deployment, false);
      wallet.rememberWallet(next, false);
      setSession(null);
      setWalletOptions(null);
      setGeneration((value) => value + 1);
      setDeployment(next);
      navigate("/app");
    },
    [deployment, navigate, walletBusy],
  );
  const connect = useCallback(
    async (accountId?: string) => {
      setBusy(true);
      setError("");
      try {
        const adapter = await getAdapter();
        if (mode !== "mock" && !accountId) {
          const options = await adapter.getWalletOptions();
          if (modeRef.current === identity) setWalletOptions(options);
          return;
        }
        const result = await adapter.connect(accountId);
        if (modeRef.current !== identity) return;
        setSession(result);
        setRevision((r) => r + 1);
      } catch (error) {
        if (modeRef.current === identity) setError(messageOf(error));
      } finally {
        if (modeRef.current === identity) setBusy(false);
      }
    },
    [getAdapter, mode, identity],
  );
  const disconnect = useCallback(async () => {
    try {
      await (await getAdapter()).disconnect();
      if (modeRef.current !== identity) return;
      setSession(null);
      setRevision((r) => r + 1);
    } catch (error) {
      if (modeRef.current === identity) setError(messageOf(error));
    }
  }, [getAdapter, identity]);
  const value = useMemo(
    () => ({
      mode,
      deployment,
      selectDeployment,
      requestPending,
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
      deployment,
      selectDeployment,
      requestPending,
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
      <Fragment key={identity}>{children}</Fragment>
      {walletOptions && (
        <Suspense fallback={<p role="status">Opening wallet choices…</p>}>
          <WalletDialog
            network={deployment.network}
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
    getAdapter: typeof getAdapter;
    adapter: WritAdapter;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void getAdapter().then((value) => {
      if (active) setLoaded({ getAdapter, adapter: value });
    });
    return () => {
      active = false;
    };
  }, [getAdapter, mode]);
  return loaded?.getAdapter === getAdapter ? loaded.adapter : null;
}
export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — Writ`;
  }, [title]);
}
