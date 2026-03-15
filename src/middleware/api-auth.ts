import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { agents } from "../db/schema.js";

export type AgentRecord = typeof agents.$inferSelect;
export type AgentLookup = (apiKey: string) => Promise<AgentRecord | null>;

declare module "hono" {
  interface ContextVariableMap {
    agent: AgentRecord;
  }
}

export const unauthorizedResponse = { error: "Unauthorized" } as const;

export const buildApiAuthMiddleware = (lookupAgent: AgentLookup) =>
  createMiddleware(async (c, next) => {
    const apiKey = c.req.header("X-API-Key");

    if (!apiKey) {
      return c.json(unauthorizedResponse, 401);
    }

    const agent = await lookupAgent(apiKey);
    if (!agent || agent.isActive !== 1) {
      return c.json(unauthorizedResponse, 401);
    }

    c.set("agent", agent);
    await next();
  });

export const lookupAgentByApiKey: AgentLookup = async (apiKey) => {
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.apiKey, apiKey))
    .limit(1);

  return agent ?? null;
};

export const apiAuthMiddleware = buildApiAuthMiddleware(lookupAgentByApiKey);
