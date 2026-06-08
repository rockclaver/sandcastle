# Plan: Multi-Language Profile Support For Sandcastle Init

> Source PRD: conversation PRD — "Multi-Language Profile Support For Sandcastle Init"

## Architectural decisions

Durable decisions that apply across all phases:

- **Profile model**: Sandcastle owns an internal profile registry. The initial profile names are `js-ts`, `flutter`, `dart`, and `go`.
- **Init selection**: `sandcastle init` supports one or more selected profiles. CLI automation uses comma-separated `--profile` values, and interactive init uses multi-select with `js-ts` selected by default.
- **Generated artifacts**: selected profile guidance is scaffolded into `.sandcastle/` as markdown plus generated metadata that templates can reference.
- **Template shape**: workflow templates stay self-contained. Profile support is added as generated profile guidance and lightweight scaffold rewriting, not by duplicating every workflow template per language.
- **Validation behavior**: selected profiles provide stack-specific guidance and suggested validation commands. Sandcastle does not install, pin, or manage Flutter, Dart, or Go SDK versions.
- **Repository detection**: init performs simple repository-signal detection and warns on mismatches without failing. Warnings are advisory because monorepos, partial checkouts, and custom layouts are valid.
- **Detection signals**: `js-ts` uses `package.json` or JS package-manager lockfiles, `flutter` uses `pubspec.yaml` with Flutter markers, `dart` uses `pubspec.yaml` without Flutter markers, and `go` uses `go.mod`.
- **Public docs and release note**: the behavior is public-facing, so README/docs must explain profile selection and a patch changeset must be added for `@rockclaver/sandcastle`.

---

## Phase 1: Profile Registry And Default JS/TS Scaffold

**User stories**: 4, 6, 8

### What to build

Create the internal profile registry and route the existing default init behavior through the explicit `js-ts` profile. A newly initialized JS/TS project should still feel like the current scaffold, while the generated config now contains profile guidance and metadata proving that profiles are part of the scaffold contract.

### Acceptance criteria

- [ ] The internal profile registry exposes `js-ts`, `flutter`, `dart`, and `go` with stable names, labels, guidance content, and validation command guidance.
- [ ] `js-ts` is the default selected profile when no profile is explicitly provided to the scaffold layer.
- [ ] Scaffolding with the default options creates profile guidance in `.sandcastle/` for `js-ts`.
- [ ] Scaffolding with the default options creates generated profile metadata listing `js-ts`.
- [ ] Existing JS/TS scaffold behavior remains compatible with current template tests.
- [ ] Registry tests cover valid names, defaults, duplicate handling, and unknown profile errors.

---

## Phase 2: CLI Profile Selection

**User stories**: 1, 2, 3, 5

### What to build

Make profile selection a first-class `sandcastle init` input. CLI users can pass comma-separated profiles, and interactive users can multi-select profiles. A generated scaffold for a Flutter app plus Go backend should include both profile selections end to end.

### Acceptance criteria

- [ ] `sandcastle init --help` documents `--profile`.
- [ ] `--profile js-ts,go` selects both profiles non-interactively and preserves the first occurrence order.
- [ ] Duplicate profile names are de-duplicated without changing the selected order.
- [ ] Unknown profile names fail early with an error that lists available profiles.
- [ ] In non-interactive mode, omitting `--profile` falls back to the `js-ts` default instead of requiring another flag.
- [ ] Interactive init offers multi-select profile selection with `js-ts` selected initially.
- [ ] CLI tests cover valid profile flags, unknown profile errors, and full non-interactive init with multiple profiles.

---

## Phase 3: Profile-Aware Template Output

**User stories**: 1, 2, 3, 8, 9

### What to build

Update generated prompts and `main` setup defaults so agents are pointed at selected profile guidance instead of receiving npm-only assumptions. The workflow templates should remain workflow-specific, while profile guidance supplies stack-specific validation and setup commands.

### Acceptance criteria

- [ ] Generated prompt files reference the scaffolded profile guidance for selected profiles.
- [ ] Generated main setup defaults avoid hard-coded JS-only setup assumptions when non-JS profiles are selected.
- [ ] Selecting `flutter` scaffolds Flutter-aware validation guidance and does not scaffold unrelated Go-only guidance.
- [ ] Selecting `go` scaffolds Go-aware validation guidance and does not scaffold unrelated Flutter-only guidance.
- [ ] Selecting `flutter,go` scaffolds both profile guidance files and generated metadata lists both profiles.
- [ ] Planner and reviewer templates reference selected profile guidance consistently.
- [ ] Template/scaffold tests assert selected profile guidance exists, unselected guidance is absent, and generated files reference the profile guidance.

---

## Phase 4: Repository Detection Warnings

**User stories**: 7

### What to build

Add lightweight repository detection during init so selected profiles can be checked against the target checkout. Detection should surface likely mistakes without blocking legitimate monorepos or custom layouts.

### Acceptance criteria

- [ ] Init detects JS/TS repository signals from `package.json` or supported lockfiles.
- [ ] Init detects Flutter repository signals from `pubspec.yaml` with Flutter markers.
- [ ] Init detects standalone Dart repository signals from `pubspec.yaml` without Flutter markers.
- [ ] Init detects Go repository signals from `go.mod`.
- [ ] Matching selected profiles produce no mismatch warning.
- [ ] Mismatching selected profiles print warning-only feedback and continue scaffolding.
- [ ] Detection tests cover matching and mismatching fixture repositories, including a mixed Flutter plus Go repository.

---

## Phase 5: Docs, Changeset, And Contributor Path

**User stories**: 5, 6, 8, 9

### What to build

Document profile selection for users and contributors, then add the release note. The docs should make clear that profiles are internal registry entries in v1, not user-defined config or SDK management.

### Acceptance criteria

- [ ] README documents `sandcastle init --profile`, interactive multi-profile selection, and examples such as `--profile flutter,go`.
- [ ] README or docs explain what profile guidance files are generated and how agents should use them.
- [ ] Contributor docs explain how to add a new internal profile entry without duplicating workflow templates.
- [ ] Documentation states that SDK version pinning and automatic Flutter/Dart/Go installation are out of scope for profiles.
- [ ] Existing changesets are checked for duplicates before adding a new one.
- [ ] A patch changeset exists for `@rockclaver/sandcastle`.
- [ ] `npm run typecheck` and relevant Vitest suites pass.
