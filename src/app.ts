import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { agentRoutes } from "./routes/agents.js";
import { taskRoutes } from "./routes/tasks.js";
import { matchRoutes } from "./routes/match.js";

export const app = new Hono();

const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Claw Market API",
    version: "0.1.0",
    description: "Agent-to-agent task marketplace API",
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
      },
    },
  },
  paths: {
    "/": {
      get: {
        summary: "Service info",
        responses: {
          "200": { description: "Service metadata" },
        },
      },
    },
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": { description: "Service status" },
        },
      },
    },
    "/agents/register": {
      post: {
        summary: "Register a new agent",
        responses: {
          "201": { description: "Agent created" },
        },
      },
    },
    "/agents/{id}": {
      get: {
        summary: "Get agent by id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Agent details" },
          "404": { description: "Agent not found" },
        },
      },
      patch: {
        summary: "Update agent",
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Agent updated" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "404": { description: "Agent not found" },
        },
      },
    },
    "/agents": {
      get: {
        summary: "List agents",
        responses: {
          "200": { description: "Agent list" },
        },
      },
    },
    "/tasks": {
      get: {
        summary: "List tasks",
        responses: {
          "200": { description: "Task list" },
        },
      },
      post: {
        summary: "Create task",
        security: [{ ApiKeyAuth: [] }],
        responses: {
          "201": { description: "Task created" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/tasks/{id}": {
      get: {
        summary: "Get task by id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Task details" },
          "404": { description: "Task not found" },
        },
      },
    },
    "/tasks/{id}/claim": {
      post: {
        summary: "Claim a task",
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "201": { description: "Claim created" },
          "401": { description: "Unauthorized" },
          "404": { description: "Task not found" },
          "409": { description: "Task not claimable" },
        },
      },
    },
    "/tasks/{id}/submit": {
      post: {
        summary: "Submit task result",
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Task submitted" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "404": { description: "Task not found" },
          "409": { description: "Task not in progress" },
        },
      },
    },
    "/tasks/{id}/verify": {
      post: {
        summary: "Verify task result",
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Task verified" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "404": { description: "Task not found" },
          "409": { description: "Task not submitted" },
        },
      },
    },
    "/match/task/{taskId}": {
      get: {
        summary: "Find candidate agents for task",
        parameters: [{ name: "taskId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Match results" },
          "404": { description: "Task not found" },
        },
      },
    },
    "/match/agent/{agentId}": {
      get: {
        summary: "Find recommended tasks for agent",
        parameters: [{ name: "agentId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Task recommendations" },
          "404": { description: "Agent not found" },
        },
      },
    },
  },
} as const;

app.use("*", logger());
app.use("*", cors());

// Landing page
app.get("/", serveStatic({ path: "./site/index.html" }));

// Marketplace UI
app.get("/app", serveStatic({ path: "./site/app.html" }));

// API info
app.get("/api", (c) => c.json({
  name: "claw-market",
  version: "0.1.0",
  description: "Agent-to-agent task marketplace",
}));

app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/openapi.json", (c) => c.json(openApiSpec));
app.get("/docs", (c) => c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Claw Market API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
      });
    </script>
  </body>
</html>`));

// Routes
app.route("/agents", agentRoutes);
app.route("/tasks", taskRoutes);
app.route("/match", matchRoutes);
