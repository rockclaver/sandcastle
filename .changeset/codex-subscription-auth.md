---
"@rockclaver/sandcastle": patch
---

Fix Codex subscription auth in scaffolded projects. Generated `main.mts` now loads `.sandcastle/.env` into the host process so `agent()` actually honors `AGENT` / `AGENT_MODEL` when selecting the provider (previously these only reached the sandbox container, so the host-side selection silently fell back to the baked default). When Codex is the active agent, the host's `~/.codex/auth.json` (ChatGPT/Codex subscription login) is bind-mounted into the sandbox so the codex CLI is logged in. Note: a single subscription token shared across concurrent sandboxes can be invalidated by codex token rotation — prefer an API key for heavily parallel runs.
