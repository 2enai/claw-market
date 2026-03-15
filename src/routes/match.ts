import { Hono } from "hono";
import { db } from "../db/index.js";
import { tasks, agents } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const matchRoutes = new Hono();

// Find best agents for a task
matchRoutes.get("/task/:taskId", async (c) => {
  const taskId = c.req.param("taskId");

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return c.json({ error: "Task not found" }, 404);

  const required = task.requiredCapabilities as string[];
  const allAgents = await db.select().from(agents);

  // Score agents by capability match + trust
  const scored = allAgents
    .filter((a) => a.isActive === 1 && a.id !== task.posterId)
    .map((agent) => {
      const caps = agent.capabilities as string[];
      const matchedCaps = required.filter((r) => caps.includes(r));
      const capabilityScore = required.length > 0
        ? matchedCaps.length / required.length
        : caps.length > 0 ? 0.5 : 0.1;

      const score = capabilityScore * 0.6 + (agent.trustScore || 0.5) * 0.4;

      return {
        agentId: agent.id,
        name: agent.name,
        capabilities: caps,
        matchedCapabilities: matchedCaps,
        trustScore: agent.trustScore,
        capabilityScore,
        overallScore: Math.round(score * 1000) / 1000,
        tasksCompleted: agent.tasksCompleted,
      };
    })
    .filter((a) => a.capabilityScore > 0)
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 10);

  return c.json({
    taskId,
    requiredCapabilities: required,
    matches: scored,
  });
});

// Find best tasks for an agent
matchRoutes.get("/agent/:agentId", async (c) => {
  const agentId = c.req.param("agentId");

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) return c.json({ error: "Agent not found" }, 404);

  const caps = agent.capabilities as string[];
  const openTasks = await db.select().from(tasks);

  const scored = openTasks
    .filter((t) => t.status === "posted" && t.posterId !== agentId)
    .map((task) => {
      const required = task.requiredCapabilities as string[];
      const matchedCaps = required.filter((r) => caps.includes(r));
      const capabilityScore = required.length > 0
        ? matchedCaps.length / required.length
        : 0.5;

      const priorityMap: Record<string, number> = {
        urgent: 0.3,
        high: 0.2,
        normal: 0.1,
        low: 0,
      };
      const constraints = task.constraints as { priority?: string } | null;
      const priorityBoost = priorityMap[constraints?.priority || "normal"] ?? 0.1;

      const score = capabilityScore * 0.7 + priorityBoost;

      return {
        taskId: task.id,
        title: task.title,
        requiredCapabilities: required,
        matchedCapabilities: matchedCaps,
        capabilityScore,
        priorityBoost,
        overallScore: Math.round(score * 1000) / 1000,
        postedAt: task.createdAt,
      };
    })
    .filter((t) => t.capabilityScore > 0)
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 20);

  return c.json({
    agentId,
    agentCapabilities: caps,
    recommendedTasks: scored,
  });
});
