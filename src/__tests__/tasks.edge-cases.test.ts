import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDbHarness } from "./helpers/mock-db.js";

let app: typeof import("../app.js").app;
let reset: () => void;

beforeEach(async () => {
  vi.resetModules();
  const harness = createMockDbHarness();
  reset = harness.reset;
  vi.doMock("../db/index.js", () => ({ db: harness.db }));
  vi.doMock("drizzle-orm", () => harness.operators);
  ({ app } = await import("../app.js"));
});

const postJson = async (
  path: string,
  body: Record<string, unknown>,
  apiKey?: string,
): Promise<Response> => {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (apiKey) headers["X-API-Key"] = apiKey;
  return app.request(`http://localhost${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
};

const registerAgent = async (name: string): Promise<{ id: string; apiKey: string }> => {
  const response = await postJson("/agents/register", {
    name,
    capabilities: ["typescript"],
  });

  const body = (await response.json()) as {
    agent: { id: string };
    apiKey: string;
  };

  return { id: body.agent.id, apiKey: body.apiKey };
};

const createTask = async (poster: { id: string; apiKey: string }): Promise<string> => {
  const response = await postJson("/tasks", {
    posterId: poster.id,
    title: "Ship feature",
    description: "Complete feature delivery",
    requiredCapabilities: ["typescript"],
  }, poster.apiKey);

  const body = (await response.json()) as { id: string };
  return body.id;
};

describe("Task Edge Cases", () => {
  beforeEach(() => {
    reset();
  });

  it("prevents double claim", async () => {
    const poster = await registerAgent("Poster");
    const firstWorker = await registerAgent("First Worker");
    const secondWorker = await registerAgent("Second Worker");
    const taskId = await createTask(poster);

    const firstClaim = await postJson(`/tasks/${taskId}/claim`, {
      agentId: firstWorker.id,
    }, firstWorker.apiKey);
    expect(firstClaim.status).toBe(201);

    const secondClaim = await postJson(`/tasks/${taskId}/claim`, {
      agentId: secondWorker.id,
    }, secondWorker.apiKey);
    expect(secondClaim.status).toBe(409);

    const error = (await secondClaim.json()) as { error: string };
    expect(error.error).toContain("not available");
  });

  it("rejects unauthorized submit", async () => {
    const poster = await registerAgent("Poster");
    const assignedWorker = await registerAgent("Assigned Worker");
    const unauthorizedWorker = await registerAgent("Unauthorized Worker");
    const taskId = await createTask(poster);

    await postJson(`/tasks/${taskId}/claim`, {
      agentId: assignedWorker.id,
    }, assignedWorker.apiKey);

    const submitResponse = await postJson(`/tasks/${taskId}/submit`, {
      agentId: unauthorizedWorker.id,
      result: {
        output: "done",
      },
    }, unauthorizedWorker.apiKey);

    expect(submitResponse.status).toBe(403);
    const body = (await submitResponse.json()) as { error: string };
    expect(body.error).toContain("assigned agent");
  });

  it("returns 401 for missing API key on protected routes", async () => {
    // POST /tasks without API key should 401
    const noAuthTask = await postJson("/tasks", {
      posterId: "00000000-0000-4000-8000-000000000001",
      title: "Bad payload",
      description: "Should fail",
      requiredCapabilities: [],
    });
    expect(noAuthTask.status).toBe(401);
  });

  it("returns validation errors for invalid payloads", async () => {
    const poster = await registerAgent("Poster");

    // Missing required fields (title, description)
    const invalidTask = await postJson("/tasks", {
      requiredCapabilities: [],
    }, poster.apiKey);
    expect(invalidTask.status).toBe(400);

    const taskId = await createTask(poster);

    // Claim without auth should 401
    const noAuthClaim = await postJson(`/tasks/${taskId}/claim`, {});
    expect(noAuthClaim.status).toBe(401);

    // Non-existent task
    const notFoundTask = await app.request("http://localhost/tasks/not-a-real-id");
    expect(notFoundTask.status).toBe(404);
  });
});
