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

// Simple loop: an agent that picks open issues one by one and closes them.
// Run this with: npx tsx .sandcastle/main.mts
// Or add to package.json scripts: "sandcastle": "npx tsx .sandcastle/main.mts"

await run({
  // A name for this run, shown as a prefix in log output.
  name: "worker",

  // Sandbox provider — runs the agent inside an isolated container.
  sandbox: docker({ mounts: codexAuthMounts }),

  // The agent provider is resolved at runtime by agent(): the AGENT env var
  // (or this baked default) picks the provider, AGENT_MODEL picks the model.
  agent: selectedAgent,

  // Path to the prompt file. Shell expressions inside are evaluated inside the
  // sandbox at the start of each iteration, so the agent always sees fresh data.
  promptFile: "./.sandcastle/prompt.md",

  // Maximum number of iterations (agent invocations) to run in a session.
  // Each iteration works on a single issue. Increase this to process more issues
  // per run, or set it to 1 for a single-shot mode.
  maxIterations: 3,

  // Branch strategy — merge-to-head creates a temporary branch for the agent
  // to work on, then merges the result back to HEAD when the run completes.
  // This is required when using copyToWorktree, since head mode bind-mounts
  // the host directory directly (no worktree to copy into).
  branchStrategy: { type: "merge-to-head" },

  // Copy node_modules from the host into the worktree before the sandbox
  // starts. This avoids a full npm install from scratch on every iteration.
  // The onSandboxReady hook still runs npm install as a safety net to handle
  // platform-specific binaries and any packages added since the last copy.
  copyToWorktree: ["node_modules"],

  // Lifecycle hooks — commands grouped by where they run (host or sandbox).
  hooks: {
    sandbox: {
      // onSandboxReady runs once after the sandbox is initialised and the repo is
      // synced in, before the agent starts. Use it to install dependencies or run
      // any other setup steps your project needs.
      onSandboxReady: [{ command: "npm install" }],
    },
  },
});
