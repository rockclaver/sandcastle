---
"@ai-hero/sandcastle": minor
---

`init` now supports selecting multiple agents — interactively via multi-select, or non-interactively with a comma-separated `--agent claude-code,codex`. The first selection becomes the generated `agent({ default })`. Generated `Dockerfile`/`Containerfile` compose a shared base plus per-agent install snippets under a single `FROM`/`USER`, and `.env.example` aggregates and de-duplicates the agents' API-key blocks alongside documented `AGENT=`/`AGENT_MODEL=` lines.
