import { describe, expect, it } from "vitest";
import { AGENT_DEFAULT_MODELS } from "./AgentProvider.js";
import {
  listAgents,
  getAgent,
  composeAgentDockerfile,
  composeAgentEnvExample,
} from "./InitService.js";

describe("Agent registry", () => {
  it("listAgents returns at least claude-code", () => {
    const agents = listAgents();
    expect(agents.some((a) => a.name === "claude-code")).toBe(true);
  });

  it("getAgent returns claude-code entry with expected fields", () => {
    const agent = getAgent("claude-code");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("claude-code");
    expect(agent!.defaultModel).toBe("claude-opus-4-7");
    expect(agent!.factoryImport).toBe("claudeCode");
    expect(composeAgentDockerfile([agent!.name])).toContain("FROM");
  });

  it("getAgent returns undefined for unknown agent", () => {
    expect(getAgent("nonexistent")).toBeUndefined();
  });

  it("listAgents includes pi", () => {
    const agents = listAgents();
    expect(agents.some((a) => a.name === "pi")).toBe(true);
  });

  it("getAgent returns pi entry with expected fields", () => {
    const agent = getAgent("pi");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("pi");
    expect(agent!.defaultModel).toBe("claude-sonnet-4-6");
    expect(agent!.factoryImport).toBe("pi");
    expect(composeAgentDockerfile([agent!.name])).toContain("FROM");
    expect(composeAgentDockerfile([agent!.name])).toContain(
      "@mariozechner/pi-coding-agent",
    );
  });

  it("listAgents includes codex", () => {
    const agents = listAgents();
    expect(agents.some((a) => a.name === "codex")).toBe(true);
  });

  it("getAgent returns codex entry with expected fields", () => {
    const agent = getAgent("codex");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("codex");
    expect(agent!.defaultModel).toBe("gpt-5.4-mini");
    expect(agent!.factoryImport).toBe("codex");
    expect(composeAgentDockerfile([agent!.name])).toContain("FROM");
    expect(composeAgentDockerfile([agent!.name])).toContain("@openai/codex");
  });

  it("listAgents includes opencode", () => {
    const agents = listAgents();
    expect(agents.some((a) => a.name === "opencode")).toBe(true);
  });

  it("listAgents includes cursor", () => {
    const agents = listAgents();
    expect(agents.some((a) => a.name === "cursor")).toBe(true);
  });

  it("getAgent returns cursor entry with expected fields", () => {
    const agent = getAgent("cursor");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("cursor");
    expect(agent!.defaultModel).toBe("composer-2");
    expect(agent!.factoryImport).toBe("cursor");
    expect(composeAgentDockerfile([agent!.name])).toContain("FROM");
    expect(composeAgentDockerfile([agent!.name])).toContain(
      "cursor.com/install",
    );
  });

  it("getAgent returns opencode entry with expected fields", () => {
    const agent = getAgent("opencode");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("opencode");
    expect(agent!.defaultModel).toBe("opencode/big-pickle");
    expect(agent!.factoryImport).toBe("opencode");
    expect(composeAgentDockerfile([agent!.name])).toContain("FROM");
    expect(composeAgentDockerfile([agent!.name])).toContain("opencode-ai");
  });

  it("listAgents includes copilot", () => {
    const agents = listAgents();
    expect(agents.some((a) => a.name === "copilot")).toBe(true);
  });

  it("getAgent returns copilot entry with expected fields", () => {
    const agent = getAgent("copilot");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("copilot");
    expect(agent!.factoryImport).toBe("copilot");
    expect(composeAgentDockerfile([agent!.name])).toContain("FROM");
    expect(composeAgentDockerfile([agent!.name])).toContain("@github/copilot");
  });

  it("default-model lookups for init come from AGENT_DEFAULT_MODELS", () => {
    for (const agent of listAgents()) {
      expect(agent.defaultModel).toBe(
        AGENT_DEFAULT_MODELS[agent.name as keyof typeof AGENT_DEFAULT_MODELS],
      );
    }
  });
});

describe("composeAgentDockerfile", () => {
  it("composes multiple agents into a single FROM with all install snippets", () => {
    const dockerfile = composeAgentDockerfile(["claude-code", "codex"]);
    // Exactly one base image for the whole composition.
    expect(dockerfile.match(/^FROM /gm)).toHaveLength(1);
    // Both per-agent install commands are present.
    expect(dockerfile).toContain("claude.ai/install.sh");
    expect(dockerfile).toContain("@openai/codex");
  });

  it("preserves the {{ISSUE_TRACKER_TOOLS}} placeholder for later substitution", () => {
    const dockerfile = composeAgentDockerfile(["claude-code", "codex"]);
    expect(dockerfile).toContain("{{ISSUE_TRACKER_TOOLS}}");
  });

  it("emits a single USER switch with root installs before and user installs after", () => {
    const dockerfile = composeAgentDockerfile(["codex", "cursor"]);
    expect(dockerfile.match(/^USER /gm)).toHaveLength(1);
    // codex (root install) appears before USER; cursor (user install) after.
    const userIdx = dockerfile.search(/^USER \$\{AGENT_UID\}/m);
    expect(dockerfile.indexOf("@openai/codex")).toBeLessThan(userIdx);
    expect(dockerfile.indexOf("cursor.com/install")).toBeGreaterThan(userIdx);
  });

  it("throws when given no agents", () => {
    expect(() => composeAgentDockerfile([])).toThrow();
  });

  it("throws on an unknown agent", () => {
    expect(() => composeAgentDockerfile(["nonexistent"])).toThrow();
  });
});

describe("composeAgentEnvExample", () => {
  it("de-duplicates shared key blocks across agents", () => {
    const env = composeAgentEnvExample(["claude-code", "pi"]);
    // claude-code and pi both need ANTHROPIC_API_KEY — only one block.
    expect(env.match(/^ANTHROPIC_API_KEY=/gm)).toHaveLength(1);
  });

  it("documents AGENT= with the first-selected agent as the default", () => {
    const env = composeAgentEnvExample(["claude-code", "pi"]);
    expect(env).toContain("AGENT=claude-code");
    expect(env).toContain("AGENT_MODEL=");
  });

  it("aggregates distinct key blocks for agents with different providers", () => {
    const env = composeAgentEnvExample(["claude-code", "codex"]);
    expect(env).toContain("ANTHROPIC_API_KEY=");
    expect(env).toContain("OPENAI_KEY=");
  });

  it("bakes a model override into AGENT_MODEL when provided", () => {
    const env = composeAgentEnvExample(["claude-code"], {
      modelOverride: "claude-sonnet-4-6",
    });
    expect(env).toContain("AGENT_MODEL=claude-sonnet-4-6");
  });
});
