export const authoritySteps = [
  {
    title: "Wrap a role",
    body: "A keyless executor accepts a supported contract role. The NFT controls who can ask it to act.",
    signer: "Current role holder",
  },
  {
    title: "Use its authority",
    body: "The current NFT holder can exercise the role through the executor's declared actions.",
    signer: "NFT holder",
  },
  {
    title: "Lend a scoped action",
    body: "Grant a method with exact arguments, a deposit cap and an expiry. Keep the NFT while someone else uses that permission.",
    signer: "NFT holder",
  },
  {
    title: "Pass the NFT on",
    body: "The NFT's ownership identifies the next controller. A sale is one optional way to arrange the handover.",
    signer: "NFT holder",
  },
  {
    title: "Control follows the holder",
    body: "The ownership epoch advances. Previous holder and borrower permissions stop authorizing new actions.",
    signer: "Writ contract",
    contract: true,
  },
  {
    title: "Inspect the handover",
    body: "Check declared role conditions and history. If you buy, your supported conditions must pass before that purchase settles.",
    signer: "Writ contract",
    contract: true,
  },
];
export const sellerTricks = [
  {
    attempt: "Leave a next owner waiting",
    defence: "The declared proposed-owner check must return none.",
    disclosed: false,
  },
  {
    attempt: "List during a withdrawal",
    defence: "Listing requires zero calls in flight.",
    disclosed: false,
  },
  {
    attempt: "Change the Writ after an offer",
    defence: "The buyer pins the Writ version and template.",
    disclosed: false,
  },
  {
    attempt: "Keep using an old loan",
    defence: "A sale advances the epoch. Prior loans stop authorizing calls.",
    disclosed: false,
  },
  {
    attempt: "Act while a sale is checked",
    defence: "A purchase lock pauses holder actions.",
    disclosed: false,
  },
  {
    attempt: "Replay a late callback",
    defence: "Settlement is bound to a single active purchase attempt.",
    disclosed: false,
  },
  {
    attempt: "Hide a second permission system",
    defence:
      "A template checks declared paths. It cannot discover every backdoor.",
    disclosed: true,
  },
  {
    attempt: "Change outside governance later",
    defence:
      "External governance and later state changes remain outside the guarantee.",
    disclosed: true,
  },
];
