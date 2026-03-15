import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { buildApiAuthMiddleware } from "./api-auth.js";
import type { AgentRecord } from "./api-auth.js";

const buildAgent = (overrides: Partial<AgentRecord> = {}): AgentRecord => ({
  id: "58b8dfe7-386a-4484-b8c2-b4bd7a4b220f",
  apiKey: "cm_test",
  name: "Agent Smith",
  description: null,
  capabilities: [],
  metadata: {},
  trustScore: 0.5,
  tasksCompleted: 0,
  tasksFailed: 0,
  tasksClaimed: 0,
  isActive: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("apiAuthMiddleware", () => {
  it("returns 401 when X-API-Key is missing", async () => {
    const lookup = vi.fn(async (_apiKey: string) => null);
    const app = new Hono();
    app.post("/secure", buildApiAuthMiddleware(lookup), (c) =>
      c.json({ ok: true }),
    );

    const response = await app.request("http://localhost/secure", {
      method: "POST",
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("returns 401 when API key is invalid", async () => {
    const lookup = vi.fn(async (_apiKey: string) => null);
    const app = new Hono();
    app.post("/secure", buildApiAuthMiddleware(lookup), (c) =>
      c.json({ ok: true }),
    );

    const response = await app.request("http://localhost/secure", {
      method: "POST",
      headers: {
        "X-API-Key": "cm_invalid",
      },
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(lookup).toHaveBeenCalledWith("cm_invalid");
  });

  it("returns 401 when agent is inactive", async () => {
    const lookup = vi.fn(async (_apiKey: string) => buildAgent({ isActive: 0 }));
    const app = new Hono();
    app.post("/secure", buildApiAuthMiddleware(lookup), (c) =>
      c.json({ ok: true }),
    );

    const response = await app.request("http://localhost/secure", {
      method: "POST",
      headers: {
        "X-API-Key": "cm_inactive",
      },
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("attaches authenticated agent to context", async () => {
    const lookup = vi.fn(async (_apiKey: string) => buildAgent());
    const app = new Hono();
    app.post("/secure", buildApiAuthMiddleware(lookup), (c) =>
      c.json({ agentId: c.get("agent").id }),
    );

    const response = await app.request("http://localhost/secure", {
      method: "POST",
      headers: {
        "X-API-Key": "cm_valid",
      },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ agentId: "58b8dfe7-386a-4484-b8c2-b4bd7a4b220f" });
  });
});
