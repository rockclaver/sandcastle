---
"@ai-hero/sandcastle": patch
---

Add resume support to the `pi()` agent provider. Pi sessions captured during a run can now be continued via `RunResult.resume(prompt)` or `run({ resumeSession: "<id>" })`, mirroring Claude Code and Codex. Pi's JSONL session under `~/.pi/agent/sessions/--<encoded-cwd>--/<timestamp>_<id>.jsonl` is captured to the host with its header `cwd` rewritten and resumed back into the sandbox via `pi --session <id>`. Session capture defaults to on; opt out with `pi("model", { captureSessions: false })`. Pi's print-mode `--no-session` flag is no longer hard-coded so iterations are persisted by default.
