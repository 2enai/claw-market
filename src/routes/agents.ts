import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db/index.js";
import { agents } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { apiAuthMiddleware } from "../middleware/api-auth.js";

export const agentRoutes = new Hono();

// Register a new agent
const registerSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  capabilities: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
});

agentRoutes.post("/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");
  const apiKey = `cm_${nanoid(32)}`;

  const [agent] = await db.insert(agents).values({
    name: body.name,
    description: body.description,
    capabilities: body.capabilities,
    metadata: body.metadata || {},
    apiKey,
  }).returning();

  return c.json({ agent, apiKey }, 201);
});

// Get agent by ID
agentRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  // Don't expose API key
  const { apiKey: _, ...safe } = agent;
  return c.json(safe);
});

// List agents
agentRoutes.get("/", async (c) => {
  const capability = c.req.query("capability");
  const allAgents = await db.select({
    id: agents.id,
    name: agents.name,
    description: agents.description,
    capabilities: agents.capabilities,
    trustScore: agents.trustScore,
    tasksCompleted: agents.tasksCompleted,
    isActive: agents.isActive,
    createdAt: agents.createdAt,
  }).from(agents);

  if (capability) {
    return c.json(allAgents.filter((a) =>
      (a.capabilities as string[]).includes(capability)
    ));
  }

  return c.json(allAgents);
});

// Update agent capabilities
const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

agentRoutes.patch("/:id", apiAuthMiddleware, zValidator("json", updateSchema), async (c) => {
  const id = c.req.param("id");
  const authedAgent = c.get("agent");
  const body = c.req.valid("json");

  if (authedAgent.id !== id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [updated] = await db.update(agents)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(agents.id, id))
    .returning();

  if (!updated) return c.json({ error: "Agent not found" }, 404);
  const { apiKey: _, ...safe } = updated;
  return c.json(safe);
});
