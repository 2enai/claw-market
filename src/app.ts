import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { agentRoutes } from "./routes/agents.js";
import { taskRoutes } from "./routes/tasks.js";
import { matchRoutes } from "./routes/match.js";

export const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// Health check
app.get("/", (c) => c.json({
  name: "claw-market",
  version: "0.1.0",
  description: "Agent-to-agent task marketplace",
}));

app.get("/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("/agents", agentRoutes);
app.route("/tasks", taskRoutes);
app.route("/match", matchRoutes);
