import type {
  CheckDefinition,
  CheckResult,
  JsonValue,
  ReadContext,
  RoleTemplate,
  Writ,
} from "./types";
export function atPointer(value: JsonValue, pointer: string): JsonValue {
  if (!pointer) return value;
  return pointer
    .split("/")
    .slice(1)
    .reduce<JsonValue>((v, segment) => {
      const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
      if (v === null || typeof v !== "object")
        throw new Error("Check response is missing a required field.");
      const next = Array.isArray(v) ? v[Number(key)] : v[key];
      if (next === undefined)
        throw new Error("Check response is missing a required field.");
      return next;
    }, value);
}
export function mapCheck(
  def: CheckDefinition,
  response: JsonValue,
  writ: Writ,
  read: ReadContext,
): CheckResult {
  const actual = atPointer(response, def.pointer);
  const expected = def.expected === "$WRIT" ? writ.executor : def.expected;
  const passed =
    def.operator === "group_member"
      ? Array.isArray(actual) &&
        actual.some((role) => {
          if (!role || typeof role !== "object" || Array.isArray(role))
            return false;
          const kind = role.kind;
          return (
            role.name === def.groupName &&
            kind &&
            typeof kind === "object" &&
            !Array.isArray(kind) &&
            Array.isArray(kind.Group) &&
            kind.Group.includes(expected)
          );
        })
      : def.operator === "null"
        ? actual === null
        : def.operator === "contains"
          ? Array.isArray(actual) && actual.includes(expected)
          : JSON.stringify(actual) === JSON.stringify(expected);
  return {
    id: def.id,
    label: def.label,
    method: def.method,
    actual,
    expected,
    result: passed ? "pass" : "fail",
    enforcedBy: "sale",
    read,
  };
}
export function mockChecks(
  writ: Writ,
  template: RoleTemplate,
  read: ReadContext,
): CheckResult[] {
  const rows = template.checks.map((def) =>
    mapCheck(
      def,
      def.id === "owner"
        ? writ.roleOwner
        : def.id === "profile"
          ? writ.templateId
          : def.id === "council"
            ? {roles:[{ name: "council", kind: { Group: [writ.roleOwner] } }]}
            : writ.proposedOwner,
      writ,
      read,
    ),
  );
  rows.push({
    id: "pending",
    label: "No calls in flight",
    method: "get_writ",
    actual: writ.pendingCalls,
    expected: 0,
    result: writ.pendingCalls === 0 ? "pass" : "fail",
    enforcedBy: "sale",
    read,
  });
  rows.push({
    id: "keys",
    label: "Executor has no access keys",
    method: "view_access_key_list",
    actual: writ.accessKeys,
    expected: [],
    result: writ.accessKeys.length === 0 ? "pass" : "fail",
    enforcedBy: "page",
    read,
  });
  rows.push({
    id: "code",
    label: "Executor code matches",
    method: "view_account",
    actual: writ.executorCodeHash,
    expected: "example-executor-v1",
    result: writ.executorCodeHash === "example-executor-v1" ? "pass" : "fail",
    enforcedBy: "page",
    read,
  });
  return rows;
}
