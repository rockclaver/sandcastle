---
"@rockclaver/sandcastle": minor
---

Auto-provision a host-cached Linux Flutter SDK for `flutter`/`dart` projects on the Docker provider. Scaffolded `main` now uses a new `flutterSandbox(...)` sandbox that downloads a Linux Flutter SDK matching the host's Flutter version into `~/.cache/sandcastle/flutter` (on the host, where the network works) and bind-mounts it into the container on `PATH`, so `flutter analyze` / `flutter test` run reliably instead of failing because the host SDK's binaries can't execute under Linux. Also exports `ensureLinuxFlutter`, `flutterSandboxMounts`, `flutterSandboxEnv`, and related helpers.
