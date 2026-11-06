export type AccountId = string;
export type YoctoNear = string;
export type WritStatus = "held" | "listed" | "locked" | "lent";
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface ReadContext {
  blockHeight: string;
  blockHash: string | null;
  phase?: "settlement_callback";
  observedAtMs: number;
  source: "mock" | "testnet";
}
export interface CheckDefinition {
  id: string;
  label: string;
  method: string;
  target: "role" | "executor" | "collection";
  pointer: string;
  operator: "eq" | "null" | "contains" | "group_member";
  groupName?: string;
  expected: JsonValue;
}
export interface PinDefinition {
  id: string;
  label: string;
  method: string;
  target: "role" | "executor";
  operator: "gte" | "lte";
  unit: string;
}
export interface RoleAction {
  method: string;
  label: string;
  args: Record<string, JsonValue>;
  maxDeposit: YoctoNear;
  lendable: boolean;
}
export interface RoleTemplate {
  id: string;
  name: string;
  kind: string;
  roleTitle: string;
  description: string;
  blindSpot: string;
  checks: CheckDefinition[];
  pins: PinDefinition[];
  actions: RoleAction[];
  wrapSteps: { label: string; method: string; signer: "holder" | "executor" }[];
  supportsUnwrap: boolean;
}
export interface Loan {
  id: string;
  borrower: AccountId;
  method: string;
  args: Record<string, JsonValue>;
  maxDeposit: YoctoNear;
  expiresAt: string;
  epoch: string;
}
export interface Writ {
  id: string;
  collection: AccountId;
  owner: AccountId;
  executor: AccountId;
  target: AccountId;
  templateId: string;
  templateHash: string;
  executorCodeHash: string;
  epoch: string;
  nonce: string;
  pendingCalls: number;
  status: WritStatus;
  price: YoctoNear | null;
  balance: YoctoNear;
  withdrawableFees: YoctoNear;
  tokens: { symbol: string; amount: string }[];
  loans: Loan[];
  roleOwner: AccountId | null;
  roleObservationUnavailable?: boolean;
  proposedOwner: AccountId | null;
  accessKeys: string[];
  saleDeadlineBlock?: string;
  provisioned?: boolean;
  roleConfirmed?: boolean;
  unwrapPending?: boolean;
}
export interface CheckResult {
  id: string;
  label: string;
  method: string;
  actual: JsonValue;
  expected: JsonValue;
  result: "pass" | "fail" | "unavailable";
  enforcedBy: "sale" | "page";
  read: ReadContext;
  reason?: string;
}
export interface CheckSnapshot {
  rows: CheckResult[];
  read: ReadContext;
}
export interface HistoryEntry {
  id: string;
  at: string;
  event: string;
  actor: AccountId;
  detail: string;
  refused?: boolean;
  transactionHash?: string;
}
export interface HistoryPage {
  entries: HistoryEntry[];
  source: "mock" | "indexer" | "contract";
  nextCursor?: string;
}
export interface WalletSession {
  accountId: AccountId;
}
export interface WalletOption {
  id: string;
  name: string;
  website: string;
}
export interface WritQuery {
  owner?: AccountId;
  listedOnly?: boolean;
  cursor?: string;
}
export interface WritPage {
  items: Writ[];
  nextCursor?: string;
}
export interface BuyerPin {
  id: string;
  value: string;
}
export interface BuyRequest {
  clientAttemptId?: string;
  writId: string;
  expectedNonce: string;
  expectedTemplateHash: string;
  maximumPrice: YoctoNear;
  pins: BuyerPin[];
}
export interface TransactionRef {
  hash?: string;
  mock: boolean;
}
export interface PurchaseHandle extends TransactionRef {
  writId: string;
  attemptId: string;
  buyerId?: AccountId;
}
export type RefundStatus = "pending" | "claimable" | "paid";
export type PurchaseState =
  | { status: "checking"; deadlineBlock: string }
  | {
      status: "refused";
      checks: CheckResult[];
      refundStatus: RefundStatus;
      refundTransactionHash?: string;
    }
  | {
      status: "settled";
      holder: AccountId;
      seller: AccountId;
      price: YoctoNear;
      endedLoanIds: string[];
      sellerPayment: "paid" | "claimable" | "credited";
    }
  | { status: "releasable" }
  | { status: "released"; refundStatus: RefundStatus };
export type MockScenario =
  | "clean"
  | "proposed"
  | "pending"
  | "rejected"
  | "changed"
  | "busy"
  | "insufficient"
  | "stuck"
  | "unknown";
export interface RoleActionRequest {
  writId: string;
  method: string;
  args: Record<string, JsonValue>;
  deposit: YoctoNear;
}
export interface LoanRequest {
  writId: string;
  borrower: AccountId;
  method: string;
  args: Record<string, JsonValue>;
  maxDeposit: YoctoNear;
  expiresAt: string;
}
export interface ListingRequest {
  writId: string;
  price: YoctoNear;
  expectedNonce: string;
}
export interface WrapRequest {
  templateId: string;
  target: AccountId;
}
export interface WrapInspection {
  holder: AccountId;
  isCurrentHolder: boolean;
  read: ReadContext;
}
export interface MintResult extends TransactionRef {
  writ: Writ;
}
export interface WrapStepRequest {
  writId: string;
  step: number;
}
export interface MintQuote {
  deposit: YoctoNear;
  executorFunding: YoctoNear;
  storageDeposit: YoctoNear;
  nonRefundableStorage: boolean;
}
export interface AccountRecovery {
  credit: YoctoNear;
  retired: {
    id: string;
    executor: AccountId;
    target: AccountId;
    available: YoctoNear;
  }[];
}
export interface ActionCapabilities {
  execute: boolean;
  lend: boolean;
  list: boolean;
  withdraw: boolean;
  unwrap: boolean;
  wrap: boolean;
}
