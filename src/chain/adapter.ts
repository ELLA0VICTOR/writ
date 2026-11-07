import type {
  ActionCapabilities,
  BuyRequest,
  CheckSnapshot,
  HistoryPage,
  ListingRequest,
  LoanRequest,
  MintResult,
  MockScenario,
  PurchaseHandle,
  PurchaseState,
  RoleActionRequest,
  RoleTemplate,
  TransactionRef,
  WalletSession,
  WrapInspection,
  WrapRequest,
  WrapStepRequest,
  Writ,
  WritPage,
  WritQuery,
  YoctoNear,
} from "./types";

export interface WritAdapter {
  readonly mode: "mock" | "testnet" | "mainnet";
  readonly contractId: string;
  readonly capabilities: ActionCapabilities;
  getSession(): Promise<WalletSession | null>;
  getWalletOptions(): Promise<import("./types").WalletOption[]>;
  connect(mockAccountId?: string): Promise<WalletSession>;
  disconnect(): Promise<void>;
  getSpendableBalance(accountId: string): Promise<YoctoNear>;
  getPurchaseFeeAllowance(): Promise<YoctoNear>;
  getPurchaseStorageDeposit(): Promise<YoctoNear>;
  getMintQuote(request: WrapRequest): Promise<import("./types").MintQuote>;
  getPracticeQuote(templateId?: string): Promise<import("./types").MintQuote>;
  createPracticeTarget(
    templateId?: string,
    newRequest?: boolean,
  ): Promise<string>;
  transfer(id: string, receiver: string): Promise<TransactionRef>;
  fundExecutor(id: string, amount: YoctoNear): Promise<TransactionRef>;
  fundTarget(id: string, amount: YoctoNear): Promise<TransactionRef>;
  confirmWrap(id: string): Promise<TransactionRef>;
  getAccountRecovery(
    accountId: string,
  ): Promise<import("./types").AccountRecovery>;
  withdrawCredit(amount: YoctoNear): Promise<TransactionRef>;
  withdrawRetired(id: string, amount: YoctoNear): Promise<TransactionRef>;
  getTemplates(): Promise<RoleTemplate[]>;
  getWrit(id: string, signal?: AbortSignal): Promise<Writ | null>;
  listWrits(query: WritQuery, signal?: AbortSignal): Promise<WritPage>;
  readChecks(id: string, signal?: AbortSignal): Promise<CheckSnapshot>;
  getHistory(id: string, cursor?: string): Promise<HistoryPage>;
  buy(request: BuyRequest): Promise<PurchaseHandle>;
  getPurchase(handle: PurchaseHandle): Promise<PurchaseState>;
  releaseStuck(handle: PurchaseHandle): Promise<TransactionRef>;
  claimRefund(handle: PurchaseHandle): Promise<TransactionRef>;
  execute(request: RoleActionRequest): Promise<TransactionRef>;
  lend(request: LoanRequest): Promise<TransactionRef>;
  endLoan(id: string, loanId: string): Promise<TransactionRef>;
  setListing(request: ListingRequest): Promise<TransactionRef>;
  removeListing(id: string): Promise<TransactionRef>;
  withdrawFees(id: string, amount: YoctoNear): Promise<TransactionRef>;
  inspectWrap(request: WrapRequest): Promise<WrapInspection>;
  mintWrit(request: WrapRequest): Promise<MintResult>;
  performWrapStep(request: WrapStepRequest): Promise<TransactionRef>;
  unwrap(id: string): Promise<TransactionRef>;
  setMockScenario?(scenario: MockScenario): void;
  resetMock?(): void;
  approveExampleDao?(id: string): Promise<TransactionRef>;
}
