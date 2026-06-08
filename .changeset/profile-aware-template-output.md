---
"@rockclaver/sandcastle": minor
---

Make scaffolded prompts and `main` setup profile-aware. Generated prompt files now reference the selected `.sandcastle/profiles/*.md` guidance and drop hard-coded npm verify commands, and the `main` setup hook uses the selected profile's setup command (e.g. `flutter pub get`, `go mod download`) when no JS/TS profile is selected.
