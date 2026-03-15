import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDbHarness } from "./helpers/mock-db.js";

let app: typeof import("../app.js").app;
let reset: () => void;
let state: ReturnType<typeof createMockDbHarness>["state"];

beforeEach(async () => {
  vi.resetModules();
  const harness = createMockDbHarness();
  reset = harness.reset;
  state = harness.state;
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
  capabilities: string[],
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

const createTask = async (
  poster: { id: string; apiKey: string },
  title: string,
  requiredCapabilities: string[],
  priority: "low" | "normal" | "high" | "urgent" = "normal",
): Promise<string> => {
  const response = await postJson("/tasks", {
    posterId: poster.id,
    title,
    description: `${title} description`,
    requiredCapabilities,
    constraints: { priority },
  }, poster.apiKey);

  const body = (await response.json()) as { id: string };
  return body.id;
};

describe("Matching Engine", () => {
  beforeEach(() => {
    reset();
  });

  it("scores task->agent matches by capability and trust", async () => {
    const poster = await registerAgent("Poster", ["coordination"]);
    const fullMatch = await registerAgent("Full Match", ["ts", "sql"]);
    const partialMatch = await registerAgent("Partial Match", ["ts"]);
    await registerAgent("Low Match", ["sql", "ml"]);

    const full = state.agents.find((agent) => agent.id === fullMatch.id);
    const partial = state.agents.find((agent) => agent.id === partialMatch.id);

    if (!full || !partial) {
      throw new Error("Expected seeded agents not found in mock state");
    }

    full.trustScore = 0.9;
    partial.trustScore = 1;

    const taskId = await createTask(poster, "Complex task", ["ts", "sql"]);

    const response = await app.request(`http://localhost/match/task/${taskId}`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      matches: Array<{
        agentId: string;
        capabilityScore: number;
        overallScore: number;
      }>;
    };

    expect(body.matches).toHaveLength(3);
    expect(body.matches[0]?.agentId).toBe(fullMatch.id);
    expect(body.matches[0]?.capabilityScore).toBe(1);
    expect(body.matches[0]?.overallScore).toBe(0.96);

    expect(body.matches[1]?.agentId).toBe(partialMatch.id);
    expect(body.matches[1]?.capabilityScore).toBe(0.5);
    expect(body.matches[1]?.overallScore).toBe(0.7);

    expect(body.matches.every((match) => match.agentId !== poster.id)).toBe(true);
  });

  it("scores agent->task matches using capability and priority boost", async () => {
    const poster = await registerAgent("Poster", ["coordination"]);
    const agent = await registerAgent("Specialist", ["ts", "sql"]);

    const urgentTaskId = await createTask(
      poster,
      "Urgent task",
      ["ts"],
      "urgent",
    );
    const lowTaskId = await createTask(poster, "Low task", ["sql"], "low");

    const response = await app.request(`http://localhost/match/agent/${agent.id}`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      recommendedTasks: Array<{
        taskId: string;
        overallScore: number;
        priorityBoost: number;
      }>;
    };

    expect(body.recommendedTasks).toHaveLength(2);
    expect(body.recommendedTasks[0]?.taskId).toBe(urgentTaskId);
    expect(body.recommendedTasks[0]?.overallScore).toBe(1);
    expect(body.recommendedTasks[0]?.priorityBoost).toBe(0.3);

    expect(body.recommendedTasks[1]?.taskId).toBe(lowTaskId);
    expect(body.recommendedTasks[1]?.overallScore).toBe(0.7);
  });
});
