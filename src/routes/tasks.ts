import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db/index.js";
import { tasks, claims, agents } from "../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";

export const taskRoutes = new Hono();

// Post a new task
const createTaskSchema = z.object({
  posterId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  requiredCapabilities: z.array(z.string()).default([]),
  acceptanceCriteria: z.record(z.unknown()).optional(),
  constraints: z.object({
    timeoutMinutes: z.number().positive().optional(),
    maxBudget: z.number().positive().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  }).optional(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    type: z.string(),
  })).optional(),
});

taskRoutes.post("/", zValidator("json", createTaskSchema), async (c) => {
  const body = c.req.valid("json");

  const [task] = await db.insert(tasks).values({
    posterId: body.posterId,
    title: body.title,
    description: body.description,
    requiredCapabilities: body.requiredCapabilities,
    acceptanceCriteria: body.acceptanceCriteria || {},
    constraints: body.constraints || {},
    attachments: body.attachments || [],
  }).returning();

  return c.json(task, 201);
});

// List tasks
taskRoutes.get("/", async (c) => {
  const status = c.req.query("status");
  const capability = c.req.query("capability");

  let allTasks = await db.select().from(tasks).orderBy(tasks.createdAt);

  if (status) {
    allTasks = allTasks.filter((t) => t.status === status);
  }

  if (capability) {
    allTasks = allTasks.filter((t) =>
      (t.requiredCapabilities as string[]).includes(capability)
    );
  }

  return c.json(allTasks);
});

// Get task by ID
taskRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return c.json({ error: "Task not found" }, 404);
  return c.json(task);
});

// Claim a task
const claimSchema = z.object({
  agentId: z.string().uuid(),
  note: z.string().optional(),
});

taskRoutes.post("/:id/claim", zValidator("json", claimSchema), async (c) => {
  const taskId = c.req.param("id");
  const body = c.req.valid("json");

  // Check task exists and is claimable
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return c.json({ error: "Task not found" }, 404);
  if (!["posted", "matched"].includes(task.status)) {
    return c.json({ error: "Task is not available for claiming" }, 409);
  }

  // Check agent exists
  const [agent] = await db.select().from(agents).where(eq(agents.id, body.agentId));
  if (!agent) return c.json({ error: "Agent not found" }, 404);

  // Create claim and update task
  const [claim] = await db.insert(claims).values({
    taskId,
    agentId: body.agentId,
    note: body.note,
  }).returning();

  await db.update(tasks).set({
    status: "claimed",
    resolvedById: body.agentId,
    claimedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(tasks.id, taskId));

  // Update agent stats
  await db.update(agents).set({
    tasksClaimed: agent.tasksClaimed + 1,
    updatedAt: new Date(),
  }).where(eq(agents.id, body.agentId));

  return c.json(claim, 201);
});

// Submit task result
const submitSchema = z.object({
  agentId: z.string().uuid(),
  result: z.record(z.unknown()),
});

taskRoutes.post("/:id/submit", zValidator("json", submitSchema), async (c) => {
  const taskId = c.req.param("id");
  const body = c.req.valid("json");

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return c.json({ error: "Task not found" }, 404);
  if (!["claimed", "in_progress"].includes(task.status)) {
    return c.json({ error: "Task is not in progress" }, 409);
  }
  if (task.resolvedById !== body.agentId) {
    return c.json({ error: "Only the assigned agent can submit results" }, 403);
  }

  // Update task
  await db.update(tasks).set({
    status: "submitted",
    result: body.result,
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(tasks.id, taskId));

  // Update claim
  await db.update(claims).set({
    status: "completed",
    result: body.result,
    completedAt: new Date(),
  }).where(and(
    eq(claims.taskId, taskId),
    eq(claims.agentId, body.agentId),
  ));

  // Update agent stats
  const [agent] = await db.select().from(agents).where(eq(agents.id, body.agentId));
  if (agent) {
    const completed = agent.tasksCompleted + 1;
    const total = completed + agent.tasksFailed;
    const trustScore = total > 0 ? completed / total : 0.5;

    await db.update(agents).set({
      tasksCompleted: completed,
      trustScore,
      updatedAt: new Date(),
    }).where(eq(agents.id, body.agentId));
  }

  return c.json({ status: "submitted", taskId });
});

// Verify/accept task result (by poster)
const verifySchema = z.object({
  posterId: z.string().uuid(),
  accepted: z.boolean(),
  feedback: z.string().optional(),
});

taskRoutes.post("/:id/verify", zValidator("json", verifySchema), async (c) => {
  const taskId = c.req.param("id");
  const body = c.req.valid("json");

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return c.json({ error: "Task not found" }, 404);
  if (task.status !== "submitted") {
    return c.json({ error: "Task is not submitted for verification" }, 409);
  }
  if (task.posterId !== body.posterId) {
    return c.json({ error: "Only the poster can verify" }, 403);
  }

  const newStatus = body.accepted ? "verified" : "rejected";

  await db.update(tasks).set({
    status: newStatus,
    updatedAt: new Date(),
  }).where(eq(tasks.id, taskId));

  // If rejected, update agent failure stats
  if (!body.accepted && task.resolvedById) {
    const [agent] = await db.select().from(agents).where(eq(agents.id, task.resolvedById));
    if (agent) {
      const failed = agent.tasksFailed + 1;
      const total = agent.tasksCompleted + failed;
      const trustScore = total > 0 ? agent.tasksCompleted / total : 0.5;

      await db.update(agents).set({
        tasksFailed: failed,
        trustScore,
        updatedAt: new Date(),
      }).where(eq(agents.id, task.resolvedById));
    }
  }

  return c.json({ status: newStatus, taskId });
});
