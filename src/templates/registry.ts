import owner from "./contract-owner.json";
import dao from "./dao-council.json";
import pool from "./staking-pool-owner.json";
import validation from "../content/template-validation.json";
import type { RoleTemplate } from "../chain/types";
export const templates = [owner, dao, pool] as unknown as RoleTemplate[];
export function getTemplate(id: string): RoleTemplate {
  const template = templates.find((t) => t.id === id);
  if (!template) throw new Error(`Unsupported role template: ${id}`);
  return template;
}
export const validatedTemplates = templates.filter(
  (t) => validation[t.id as keyof typeof validation]?.sandboxPassed,
);
