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
): Promise<Response> =>
  app.request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

const registerAgent = async (name: string): Promise<string> => {
  const response = await postJson("/agents/register", {
    name,
    capabilities: ["typescript"],
  });

  const body = (await response.json()) as {
    agent: { id: string };
  };

  return body.agent.id;
};

const createTask = async (posterId: string): Promise<string> => {
  const response = await postJson("/tasks", {
    posterId,
    title: "Ship feature",
    description: "Complete feature delivery",
    requiredCapabilities: ["typescript"],
  });

  const body = (await response.json()) as { id: string };
  return body.id;
};

describe("Task Edge Cases", () => {
  beforeEach(() => {
    reset();
  });

  it("prevents double claim", async () => {
    const posterId = await registerAgent("Poster");
    const firstWorker = await registerAgent("First Worker");
    const secondWorker = await registerAgent("Second Worker");
    const taskId = await createTask(posterId);

    const firstClaim = await postJson(`/tasks/${taskId}/claim`, {
      agentId: firstWorker,
    });
    expect(firstClaim.status).toBe(201);

    const secondClaim = await postJson(`/tasks/${taskId}/claim`, {
      agentId: secondWorker,
    });
    expect(secondClaim.status).toBe(409);

    const error = (await secondClaim.json()) as { error: string };
    expect(error.error).toContain("not available");
  });

  it("rejects unauthorized submit", async () => {
    const posterId = await registerAgent("Poster");
    const assignedWorker = await registerAgent("Assigned Worker");
    const unauthorizedWorker = await registerAgent("Unauthorized Worker");
    const taskId = await createTask(posterId);

    await postJson(`/tasks/${taskId}/claim`, {
      agentId: assignedWorker,
    });

    const submitResponse = await postJson(`/tasks/${taskId}/submit`, {
      agentId: unauthorizedWorker,
      result: {
        output: "done",
      },
    });

    expect(submitResponse.status).toBe(403);
    const body = (await submitResponse.json()) as { error: string };
    expect(body.error).toContain("assigned agent");
  });

  it("returns validation errors for invalid IDs", async () => {
    const invalidTask = await postJson("/tasks", {
      posterId: "not-a-uuid",
      title: "Bad payload",
      description: "Should fail",
      requiredCapabilities: [],
    });
    expect(invalidTask.status).toBe(400);

    const posterId = await registerAgent("Poster");
    const taskId = await createTask(posterId);

    const invalidClaim = await postJson(`/tasks/${taskId}/claim`, {
      agentId: "bad-agent-id",
    });
    expect(invalidClaim.status).toBe(400);

    const notFoundTask = await app.request("http://localhost/tasks/not-a-real-id");
    expect(notFoundTask.status).toBe(404);
  });
});
