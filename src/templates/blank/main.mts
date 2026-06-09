import { existsSync } from "node:fs";
import { run, agent } from "@rockclaver/sandcastle";
import { docker } from "@rockclaver/sandcastle/sandboxes/docker";

// Load .sandcastle/.env into the host process so agent() can read AGENT /
// AGENT_MODEL when selecting the provider. The env resolver only injects
// these into the sandbox container, so without this the host-side agent()
// call ignores AGENT and falls back to its baked-in default.
if (existsSync(".sandcastle/.env")) process.loadEnvFile(".sandcastle/.env");

// Resolve the agent once so we can both run it and detect codex below.
const selectedAgent = agent({ default: "claude-code" });

// Codex authenticates with the host's ~/.codex/auth.json (ChatGPT/Codex
// subscription login). Bind-mount it into the sandbox so codex is logged in
// inside the container. Empty for other agents. Note: one subscription token
// shared across concurrent sandboxes can be invalidated by codex token
// rotation — prefer an API key for heavily parallel runs.
const codexAuthMounts =
  selectedAgent.name === "codex"
    ? [{ hostPath: "~/.codex/auth.json", sandboxPath: "~/.codex/auth.json" }]
    : [];

// Blank template: customize this to build your own orchestration.
// Run this with: npx tsx .sandcastle/main.mts
// Or add to package.json scripts: "sandcastle": "npx tsx .sandcastle/main.mts"

await run({
  // The agent provider is resolved at runtime by agent(): the AGENT env var
  // (or this baked default) picks the provider, AGENT_MODEL picks the model.
  agent: selectedAgent,
  sandbox: docker({ mounts: codexAuthMounts }),
  promptFile: "./.sandcastle/prompt.md",
});
