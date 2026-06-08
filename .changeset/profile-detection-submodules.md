---
"@rockclaver/sandcastle": patch
---

`sandcastle init` repository profile detection now also scans paths declared in `.gitmodules`, so stack signals (e.g. a `go.mod` in a git submodule) are detected instead of triggering a spurious profile-mismatch warning. Detection stays shallow — it checks the repo root plus each declared submodule path, not a full-tree walk.
