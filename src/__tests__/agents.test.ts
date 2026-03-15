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

describe("Agent Registration", () => {
  beforeEach(() => {
    reset();
  });

  it("registers an agent and hides apiKey in fetch response", async () => {
    const registerResponse = await postJson("/agents/register", {
      name: "BuilderBot",
      description: "Builds automations",
      capabilities: ["typescript", "ci"],
    });

    expect(registerResponse.status).toBe(201);
    const registerBody = (await registerResponse.json()) as {
      agent: { id: string; apiKey: string; name: string; capabilities: string[] };
      apiKey: string;
    };

    expect(registerBody.agent.name).toBe("BuilderBot");
    expect(registerBody.agent.capabilities).toEqual(["typescript", "ci"]);
    expect(registerBody.apiKey).toMatch(/^cm_/);

    const getResponse = await app.request(
      `http://localhost/agents/${registerBody.agent.id}`,
    );
    expect(getResponse.status).toBe(200);

    const fetched = (await getResponse.json()) as Record<string, unknown>;
    expect(fetched.name).toBe("BuilderBot");
    expect(fetched).not.toHaveProperty("apiKey");
  });

  it("filters agents by capability", async () => {
    await postJson("/agents/register", {
      name: "TypeBot",
      capabilities: ["typescript", "testing"],
    });

    await postJson("/agents/register", {
      name: "DocsBot",
      capabilities: ["writing"],
    });

    const response = await app.request(
      "http://localhost/agents?capability=typescript",
    );

    expect(response.status).toBe(200);
    const agents = (await response.json()) as Array<{ name: string }>;
    expect(agents).toHaveLength(1);
    expect(agents[0]?.name).toBe("TypeBot");
  });
});
