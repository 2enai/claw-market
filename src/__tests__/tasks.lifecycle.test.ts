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

const registerAgent = async (
  name: string,
  capabilities: string[] = ["typescript", "testing"],
): Promise<{ id: string; apiKey: string }> => {
  const response = await postJson("/agents/register", {
    name,
    capabilities,
  });

  const body = (await response.json()) as {
    agent: { id: string };
    apiKey: string;
  };

  return { id: body.agent.id, apiKey: body.apiKey };
};

describe("Task CRUD Lifecycle", () => {
  beforeEach(() => {
    reset();
  });

  it("runs task post -> claim -> submit -> verify flow", async () => {
    const poster = await registerAgent("Poster");
    const worker = await registerAgent("Worker");

    const createTaskResponse = await postJson("/tasks", {
      posterId: poster.id,
      title: "Add tests",
      description: "Create robust unit tests",
      requiredCapabilities: ["typescript"],
      constraints: { priority: "high" },
    }, poster.apiKey);

    expect(createTaskResponse.status).toBe(201);
    const createdTask = (await createTaskResponse.json()) as { id: string };

    const claimResponse = await postJson(`/tasks/${createdTask.id}/claim`, {
      agentId: worker.id,
      note: "I can take this",
    }, worker.apiKey);
    expect(claimResponse.status).toBe(201);

    const submitResponse = await postJson(`/tasks/${createdTask.id}/submit`, {
      agentId: worker.id,
      result: {
        summary: "Implemented test suite",
      },
    }, worker.apiKey);
    expect(submitResponse.status).toBe(200);

    const verifyResponse = await postJson(`/tasks/${createdTask.id}/verify`, {
      posterId: poster.id,
      accepted: true,
      feedback: "Looks good",
    }, poster.apiKey);
    expect(verifyResponse.status).toBe(200);
    const verifyBody = (await verifyResponse.json()) as { status: string };
    expect(verifyBody.status).toBe("verified");

    const taskResponse = await app.request(
      `http://localhost/tasks/${createdTask.id}`,
    );
    const updatedTask = (await taskResponse.json()) as {
      status: string;
      resolvedById: string;
    };

    expect(updatedTask.status).toBe("verified");
    expect(updatedTask.resolvedById).toBe(worker.id);

    const workerResponse = await app.request(`http://localhost/agents/${worker.id}`);
    const workerData = (await workerResponse.json()) as {
      tasksClaimed: number;
      tasksCompleted: number;
      trustScore: number;
    };

    expect(workerData.tasksClaimed).toBe(1);
    expect(workerData.tasksCompleted).toBe(1);
    expect(workerData.trustScore).toBe(1);
  });
});
