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
    capabilities: ["typescript", "testing"],
  });

  const body = (await response.json()) as {
    agent: { id: string };
  };

  return body.agent.id;
};

describe("Task CRUD Lifecycle", () => {
  beforeEach(() => {
    reset();
  });

  it("runs task post -> claim -> submit -> verify flow", async () => {
    const posterId = await registerAgent("Poster");
    const workerId = await registerAgent("Worker");

    const createTaskResponse = await postJson("/tasks", {
      posterId,
      title: "Add tests",
      description: "Create robust unit tests",
      requiredCapabilities: ["typescript"],
      constraints: { priority: "high" },
    });

    expect(createTaskResponse.status).toBe(201);
    const createdTask = (await createTaskResponse.json()) as { id: string };

    const claimResponse = await postJson(`/tasks/${createdTask.id}/claim`, {
      agentId: workerId,
      note: "I can take this",
    });
    expect(claimResponse.status).toBe(201);

    const submitResponse = await postJson(`/tasks/${createdTask.id}/submit`, {
      agentId: workerId,
      result: {
        summary: "Implemented test suite",
      },
    });
    expect(submitResponse.status).toBe(200);

    const verifyResponse = await postJson(`/tasks/${createdTask.id}/verify`, {
      posterId,
      accepted: true,
      feedback: "Looks good",
    });
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
    expect(updatedTask.resolvedById).toBe(workerId);

    const workerResponse = await app.request(`http://localhost/agents/${workerId}`);
    const worker = (await workerResponse.json()) as {
      tasksClaimed: number;
      tasksCompleted: number;
      trustScore: number;
    };

    expect(worker.tasksClaimed).toBe(1);
    expect(worker.tasksCompleted).toBe(1);
    expect(worker.trustScore).toBe(1);
  });
});
