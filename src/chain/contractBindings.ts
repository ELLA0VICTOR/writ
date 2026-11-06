// Proposed frontend ABI. This is deliberately disabled until a deployment opts in.
// It does not assert that a matching contract is currently deployed.
export const bindings = {
  abiVersion: "writ-ui-v1",
  config: "get_frontend_config",
  writ: "get_writ",
  list: "get_writs",
  history: "get_history",
  purchase: "get_purchase",
  buy: "buy",
  release: "release_stuck",
  refund: "claim_refund",
  execute: "execute",
  lend: "lend",
  endLoan: "end_loan",
  listForSale: "list",
  unlist: "unlist",
  withdraw: "withdraw_fees",
  mint: "mint",
  wrap: "wrap_step",
  unwrap: "unwrap",
} as const;
