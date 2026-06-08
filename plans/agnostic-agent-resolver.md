# Plan: Agnostic `agent()` resolver

> Source PRD: rockclaver/sandcastle#1 — "Agnostic agent() resolver: runtime agent selection via AGENT env var"

## Architectural decisions

Durable decisions that apply across all phases:

- **New public export**: `agent()` from `src/index.ts`, implemented in `src/AgentProvider.ts` alongside the existing factories (`claudeCode`, `codex`, `cursor`, `opencode`, `copilot`, `pi`). Returns the same `AgentProvider` shape `run()` already consumes (src/run.ts:212, src/run.ts:382) — no Orchestrator changes.
- **Env vars**: `AGENT` (agent name) and `AGENT_MODEL` (model override). Env-var-only selection — no CLI flag on `main.mts`, no `sandcastle run` subcommand.
- **Resolver options shape**: `agent({ default: "<agent-name>", claudeCode?: ClaudeCodeOptions, codex?: CodexOptions, cursor?: CursorOptions, opencode?: OpenCodeOptions, copilot?: CopilotOptions, pi?: PiOptions })`. Only the selected provider's options are forwarded; the rest are ignored.
- **Resolution order**: name = `process.env.AGENT` → `options.default` → throw listing valid names. model = `process.env.AGENT_MODEL` → per-agent default model (always available).
- **Single source of truth for default models**: extract `AGENT_DEFAULT_MODELS` into `src/AgentProvider.ts`; `AGENT_REGISTRY.defaultModel` (src/InitService.ts:409-474) references it so init and runtime never drift.
- **Valid agent names**: `claude-code`, `pi`, `codex`, `cursor`, `opencode`, `copilot` (the existing registry names).
- **Dockerfile composition**: shared base + per-agent install snippet, composed for all selected agents (`composeAgentDockerfile`). Base keeps `{{ISSUE_TRACKER_TOOLS}}`, UID/GID alignment, `USER`, `WORKDIR`, `ENTRYPOINT`. Replaces the per-agent full Dockerfile templates at src/InitService.ts:207-407.
- **.env.example composition**: aggregate + de-dupe per-agent `envExample` blocks (`composeAgentEnvExample`), then append documented `AGENT=`/`AGENT_MODEL=` lines listing valid values and the init default.
- **Init agent selection**: multi-select; non-interactive `--agent` accepts comma-separated values (src/cli.ts:93, src/cli.ts:269-305). First selected agent is the `default` baked into the generated `agent({ default: "..." })` call.
- **Backward compatibility**: existing single-provider factory exports remain unchanged.
- **Changeset**: `minor` bump for `@ai-hero/sandcastle`.

---

## Phase 1: Runtime `agent()` resolver

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 13, 14, 16, 17, 18

### What to build

The end-to-end runtime selection path, verifiable by hand-editing a `main.mts` to use `agent({ default: "claude-code" })` and flipping the `AGENT` env var — no init changes required yet.

- Extract `AGENT_DEFAULT_MODELS` (name → default model) into `src/AgentProvider.ts` and have the internal `AGENT_REGISTRY` consume it.
- Implement `agent(options?)`: reads `AGENT`/`AGENT_MODEL`, resolves name (env → `default` → error), resolves model (env → per-agent default), dispatches to the matching factory, forwards only that provider's options, and returns the resulting `AgentProvider` (preserving `sessionStorage` for capture-capable providers).
- Export `agent` and its options type from `src/index.ts`.

### Acceptance criteria

- [ ] `agent` and its options type are exported from `src/index.ts`; existing factory exports still present.
- [ ] With `AGENT=codex`, the resolved provider's `.name === "codex"` and its `buildPrintCommand` contains the expected model.
- [ ] With `AGENT=claude-code`, resolution matches today's Claude Code provider behavior and the provider exposes `sessionStorage`.
- [ ] `AGENT_MODEL` set → that model appears in `buildPrintCommand`; unset → the provider's default model appears (e.g. `gpt-5.4-mini` for codex).
- [ ] `AGENT` unset → resolves to `options.default`.
- [ ] Unknown `AGENT` → throws an error whose message lists the valid names.
- [ ] `agent({ codex: { effort: "high" } })` with `AGENT=codex` forwards the effort flag; options for non-selected providers are ignored.
- [ ] Default-model lookups for init and the resolver come from the same `AGENT_DEFAULT_MODELS` source.
- [ ] Tests cover all of the above with env injected (not relying on ambient `process.env`), in the style of `src/AgentProvider.test.ts`.
- [ ] `npm run typecheck` and `npm test` pass.

---

## Phase 2: Init multi-select + composed scaffolding

**User stories**: 9, 10, 11, 12, 15

### What to build

`sandcastle init` end-to-end: pick multiple agents, get a sandbox image that installs all their CLIs, an aggregated `.env.example`, and a generated `main.mts` that uses the Phase 1 resolver. Verifiable by running `init` and inspecting the scaffold.

- Convert `--agent` / interactive selection to multi-select (comma-separated for non-interactive/CI). First selection becomes the generated `default`.
- `composeAgentDockerfile(agentNames)`: shared base + concatenated per-agent install snippets; preserves `{{ISSUE_TRACKER_TOOLS}}`.
- `composeAgentEnvExample(agentNames)`: aggregate + de-dupe key blocks, then append documented `AGENT=`/`AGENT_MODEL=` lines.
- Switch the five `src/templates/*/main.mts` templates from `claudeCode("...")` to `agent()`; update `rewriteMainTs()` (src/InitService.ts:749) to inject the `default` agent name into the `agent({ default: "..." })` call (model no longer baked in).

### Acceptance criteria

- [ ] Interactive init offers a multi-select; `--agent claude-code,codex` selects both non-interactively.
- [ ] Selecting `["claude-code","codex"]` yields a Dockerfile with a single base/`FROM` and both install commands (`claude.ai/install.sh` and `@openai/codex`), with `{{ISSUE_TRACKER_TOOLS}}` preserved.
- [ ] Selecting `["claude-code","pi"]` yields a `.env.example` with a single de-duplicated `ANTHROPIC_API_KEY`, plus documented `AGENT=`/`AGENT_MODEL=` lines listing valid values and the default.
- [ ] Generated `main.mts` contains `agent(` with the first-selected agent as `default` and no bare `claudeCode("...")`.
- [ ] All five templates use `agent()`.
- [ ] Tests cover `composeAgentDockerfile`, `composeAgentEnvExample`, and init scaffolding integration (in the style of `src/InitService.agents.test.ts` / `src/InitService.test.ts`).
- [ ] `npm run typecheck` and `npm test` pass.

---

## Phase 3: Docs + changeset

**User stories**: 19

### What to build

Make runtime selection discoverable and record the release note.

- README "agent selection" subsection covering `agent()`, `AGENT`, `AGENT_MODEL`, and the multi-select init flow (near the existing agent docs around README lines 719, 778, 896-960).
- Short CONTEXT.md note that `agent()` is the runtime resolver over agent providers.
- `minor` changeset for `@ai-hero/sandcastle`.

### Acceptance criteria

- [ ] README documents `agent()`, the `AGENT`/`AGENT_MODEL` env vars, and multi-select init.
- [ ] CONTEXT.md mentions `agent()` as the runtime resolver.
- [ ] A `minor` changeset exists for `@ai-hero/sandcastle`, with no duplicate already in `.changeset`.
