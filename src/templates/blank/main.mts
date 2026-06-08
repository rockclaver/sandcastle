import { run, agent } from "@rockclaver/sandcastle";
import { docker } from "@rockclaver/sandcastle/sandboxes/docker";

// Blank template: customize this to build your own orchestration.
// Run this with: npx tsx .sandcastle/main.mts
// Or add to package.json scripts: "sandcastle": "npx tsx .sandcastle/main.mts"

await run({
  // The agent provider is resolved at runtime by agent(): the AGENT env var
  // (or this baked default) picks the provider, AGENT_MODEL picks the model.
  agent: agent({ default: "claude-code" }),
  sandbox: docker(),
  promptFile: "./.sandcastle/prompt.md",
});
