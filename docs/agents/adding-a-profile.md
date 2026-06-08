# Adding a profile

This document is for contributors adding a new built-in **profile** — a language/stack entry (e.g. `js-ts`, `flutter`, `dart`, `go`) that supplies stack-specific guidance and suggested setup/validation commands during `sandcastle init`. It covers:

1. [What a profile is (and is not)](#what-a-profile-is-and-is-not) — the scope boundary you must respect.
2. [The `ProfileEntry` interface](#the-profileentry-interface) — what you fill in.
3. [Scaffold integration](#scaffold-integration) — adding the registry entry.
4. [Why you do not touch the workflow templates](#why-you-do-not-touch-the-workflow-templates) — the rule that keeps profiles cheap to add.
5. [Implementation checklist](#implementation-checklist) — every file to touch.

For terminology (**profile**, **config directory**, **template argument**, etc.), see [`CONTEXT.md`](../../CONTEXT.md).

## What a profile is (and is not)

A profile is **guidance only**. It describes a stack to the agent and suggests the commands the agent should run, scaffolded into `.sandcastle/profiles/`. In v1, profiles are an internal registry — they are **not** user-defined config or SDK management.

A profile **must not**:

- Install a toolchain or SDK (Flutter/Dart/Go/Node), or assume the scaffold will. The relevant toolchain is assumed to already be present in the sandbox image; pinning/installing it is the user's job via the `Dockerfile`/`Containerfile`.
- Pin or manage SDK versions.
- Duplicate a workflow template (see [below](#why-you-do-not-touch-the-workflow-templates)).

If your stack needs a tool installed in the image to even run its setup command, document that expectation in the profile's `guidance` string — do not add install steps to the scaffold.

## The `ProfileEntry` interface

Defined in [`src/InitService.ts`](../../src/InitService.ts):

```ts
export interface ProfileEntry {
  readonly name: string;
  readonly label: string;
  /** Short prose describing the stack and how the agent should treat it. */
  readonly guidance: string;
  /**
   * Suggested setup commands (dependency fetch / bootstrap). The first entry is
   * baked as the generated `main` setup hook when no JS profile is selected.
   */
  readonly setupCommands: readonly string[];
  /** Suggested validation commands the agent should run for this stack. */
  readonly validationCommands: readonly string[];
}
```

Field by field:

- `name` — short identifier (e.g. `"rust"`). Used as the CLI choice value passed to `--profile` and the guidance filename (`.sandcastle/profiles/<name>.md`). Must be unique in the registry.
- `label` — human-readable label shown in the `init` multi-select and used in the generated "Project profiles" prompt section.
- `guidance` — short prose describing the stack and how the agent should treat it. State explicitly that Sandcastle does not install or pin the SDK for this stack.
- `setupCommands` — dependency-fetch/bootstrap commands. The **first** entry is baked into the generated `main` setup hook when no JS/TS profile is selected, replacing the npm-only default.
- `validationCommands` — the commands the agent should run to validate its work (build/lint/test). Listed in the scaffolded guidance markdown.

## Scaffold integration

Add an entry to `PROFILE_REGISTRY` in [`src/InitService.ts`](../../src/InitService.ts), alongside `js-ts`, `flutter`, `dart`, and `go`:

```ts
{
  name: "rust",
  label: "Rust",
  guidance:
    "Rust crate or workspace defined by `Cargo.toml`. Build, lint, and test through Cargo. Sandcastle does not install or pin the Rust toolchain — assume it is available in the sandbox.",
  setupCommands: ["cargo fetch"],
  validationCommands: ["cargo build", "cargo clippy", "cargo test"],
}
```

That is the whole change. The registry drives everything downstream:

- `listProfiles` / `getProfile` / `resolveProfileEntries` pick it up automatically.
- The `--profile` flag and the interactive multi-select offer it with no extra wiring.
- `scaffoldProfiles` writes `.sandcastle/profiles/<name>.md` (from your `guidance` + commands) and adds the profile to `profiles.json`.
- The generated prompts gain a "Project profiles" link to your guidance file, and `main`'s setup hook uses your first `setupCommand` when no JS/TS profile is selected.

## Why you do not touch the workflow templates

Workflow templates (`blank`, `simple-loop`, `sequential-reviewer`, the planner templates) stay self-contained and **language-agnostic**. Profile support is delivered through generated profile guidance plus lightweight scaffold rewriting — **not** by forking each template per language. Adding a Rust profile must not produce a `simple-loop-rust` template.

This is the rule that keeps adding a profile a one-entry change: a new profile is `N` registry fields, not `N × (number of templates)` new template files. If you find yourself wanting to duplicate a template for a language, stop — put the stack-specific behavior in the profile's `guidance`/`validationCommands` instead.

## Implementation checklist

For a new profile `foo`:

- [ ] `PROFILE_REGISTRY` entry in [`src/InitService.ts`](../../src/InitService.ts).
- [ ] Tests in `src/InitService.profiles.test.ts` and/or `src/cli.profiles.test.ts` covering: the entry is listed by `listProfiles`, `getProfile("foo")` returns it, `resolveProfileEntries(["foo"])` resolves it (and de-dupes), selecting it scaffolds `.sandcastle/profiles/foo.md` with the expected commands and lists `foo` in `profiles.json`, and unrelated profile guidance is absent.
- [ ] No new workflow template files — confirm the templates are untouched.
- [ ] Changeset in `.changeset/` (patch, since pre-1.0). See [`CLAUDE.md`](../../CLAUDE.md).
- [ ] `README.md` update — add `foo` to the public list of supported profiles in the [Profiles](../../README.md#profiles) section and the `--profile` row of the `sandcastle init` options table.
