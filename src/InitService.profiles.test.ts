import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_NAME,
  getProfile,
  listProfiles,
  resolveProfileEntries,
  scaffold,
  getAgent,
} from "./InitService.js";
import type { ScaffoldOptions } from "./InitService.js";

const makeDir = () => mkdtemp(join(tmpdir(), "init-profiles-"));

const claudeCodeAgent = getAgent("claude-code")!;

const defaultOptions: ScaffoldOptions = { agents: [claudeCodeAgent] };

const runScaffold = (repoDir: string, options?: Partial<ScaffoldOptions>) =>
  Effect.runPromise(
    scaffold(repoDir, { ...defaultOptions, ...options }).pipe(
      Effect.provide(NodeFileSystem.layer),
    ),
  );

const readMetadata = async (repoDir: string) =>
  JSON.parse(
    await readFile(
      join(repoDir, ".sandcastle", "profiles", "profiles.json"),
      "utf-8",
    ),
  ) as { profiles: { name: string; label: string; guidance: string }[] };

const guidanceExists = async (
  repoDir: string,
  profileName: string,
): Promise<boolean> => {
  try {
    await access(join(repoDir, ".sandcastle", "profiles", `${profileName}.md`));
    return true;
  } catch {
    return false;
  }
};

const profilesFor = (...names: string[]) => names.map((n) => getProfile(n)!);

// ---------------------------------------------------------------------------
// AC: registry exposes js-ts, flutter, dart, go with stable names, labels,
//     guidance content, and validation command guidance.
// ---------------------------------------------------------------------------

describe("Profile registry", () => {
  it("AC1: exposes js-ts, flutter, dart, and go with stable names", () => {
    const names = listProfiles().map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(["js-ts", "flutter", "dart", "go"]),
    );
  });

  it.each(["js-ts", "flutter", "dart", "go"])(
    "AC1: %s entry has a label, guidance content, and validation commands",
    (name) => {
      const profile = getProfile(name);
      expect(profile).toBeDefined();
      expect(profile!.name).toBe(name);
      expect(profile!.label.length).toBeGreaterThan(0);
      expect(profile!.guidance.length).toBeGreaterThan(0);
      expect(profile!.validationCommands.length).toBeGreaterThan(0);
    },
  );

  it("getProfile returns undefined for an unknown profile", () => {
    expect(getProfile("nonexistent")).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // AC: js-ts is the default selected profile when none is provided.
  // -------------------------------------------------------------------------

  it("AC2/AC6 (defaults): resolveProfileEntries falls back to js-ts for an empty selection", () => {
    expect(DEFAULT_PROFILE_NAME).toBe("js-ts");
    const resolved = resolveProfileEntries([]);
    expect(resolved.map((p) => p.name)).toEqual(["js-ts"]);
  });

  // -------------------------------------------------------------------------
  // AC6: registry tests cover valid names, defaults, duplicate handling, and
  //      unknown profile errors.
  // -------------------------------------------------------------------------

  it("AC6 (valid names): resolveProfileEntries resolves a valid selection in order", () => {
    const resolved = resolveProfileEntries(["go", "flutter"]);
    expect(resolved.map((p) => p.name)).toEqual(["go", "flutter"]);
  });

  it("AC6 (duplicate handling): de-duplicates names while preserving first-occurrence order", () => {
    const resolved = resolveProfileEntries(["go", "js-ts", "go"]);
    expect(resolved.map((p) => p.name)).toEqual(["go", "js-ts"]);
  });

  it("AC6 (unknown profile errors): throws listing available profiles", () => {
    expect(() => resolveProfileEntries(["rust"])).toThrow(
      /Unknown profile "rust".*js-ts.*flutter.*dart.*go/,
    );
  });
});

// ---------------------------------------------------------------------------
// AC: scaffolding with default options creates js-ts guidance + metadata.
// ---------------------------------------------------------------------------

describe("Profile scaffolding", () => {
  it("AC3: default scaffold writes js-ts profile guidance into .sandcastle/", async () => {
    const dir = await makeDir();
    await runScaffold(dir);

    const guidance = await readFile(
      join(dir, ".sandcastle", "profiles", "js-ts.md"),
      "utf-8",
    );
    expect(guidance).toContain("JavaScript / TypeScript");
    // Validation command guidance is rendered into the markdown.
    expect(guidance).toContain("npm run typecheck");
  });

  it("AC4: default scaffold writes generated metadata listing js-ts", async () => {
    const dir = await makeDir();
    await runScaffold(dir);

    const metadata = await readMetadata(dir);
    expect(metadata.profiles.map((p) => p.name)).toEqual(["js-ts"]);
    expect(metadata.profiles[0]!.guidance).toBe("profiles/js-ts.md");
  });

  it("AC2 (default at scaffold layer): omitting profiles selects js-ts", async () => {
    const dir = await makeDir();
    await runScaffold(dir, { profiles: undefined });

    const metadata = await readMetadata(dir);
    expect(metadata.profiles.map((p) => p.name)).toEqual(["js-ts"]);
  });

  it("AC2 (default at scaffold layer): an empty profiles array also selects js-ts", async () => {
    const dir = await makeDir();
    await runScaffold(dir, { profiles: [] });

    const metadata = await readMetadata(dir);
    expect(metadata.profiles.map((p) => p.name)).toEqual(["js-ts"]);
  });
});

// ---------------------------------------------------------------------------
// Phase 3: Profile-Aware Template Output
// ---------------------------------------------------------------------------

describe("Profile-aware template output", () => {
  // AC (issue #11): Generated prompt files reference the scaffolded profile
  // guidance for selected profiles.
  it("AC: default scaffold prompt references the js-ts profile guidance", async () => {
    const dir = await makeDir();
    await runScaffold(dir, { templateName: "simple-loop" });

    const prompt = await readFile(
      join(dir, ".sandcastle", "prompt.md"),
      "utf-8",
    );
    expect(prompt).toContain("Project profiles");
    expect(prompt).toContain(".sandcastle/profiles/js-ts.md");
    // The hard-coded npm verify phrase is replaced by a guidance pointer.
    expect(prompt).not.toContain("`npm run typecheck` and `npm run test`");
    expect(prompt).toContain(".sandcastle/profiles/");
  });

  it("AC: go scaffold prompt references go guidance and not js-only verify commands", async () => {
    const dir = await makeDir();
    await runScaffold(dir, {
      templateName: "simple-loop",
      profiles: profilesFor("go"),
    });

    const prompt = await readFile(
      join(dir, ".sandcastle", "prompt.md"),
      "utf-8",
    );
    expect(prompt).toContain(".sandcastle/profiles/go.md");
    expect(prompt).not.toContain("`npm run typecheck` and `npm run test`");
  });

  // AC (issue #11): Generated main setup defaults avoid hard-coded JS-only
  // setup assumptions when non-JS profiles are selected.
  it("AC: go-only scaffold main drops the npm-only setup hook command", async () => {
    const dir = await makeDir();
    await runScaffold(dir, {
      templateName: "simple-loop",
      profiles: profilesFor("go"),
    });

    const main = await readFile(join(dir, ".sandcastle", "main.mts"), "utf-8");
    // The executed hook command is no longer `npm install`.
    expect(main).not.toContain('command: "npm install"');
    expect(main).toContain("go mod download");
  });

  // Codex review (PR #15): the scaffolded image ships no Go/Flutter/Dart SDK, so
  // the hook must verify the toolchain before running and never hard-fail.
  it("AC: non-JS setup hook is guarded so it never hard-fails when the SDK is absent", async () => {
    const dir = await makeDir();
    await runScaffold(dir, {
      templateName: "simple-loop",
      profiles: profilesFor("go"),
    });

    const main = await readFile(join(dir, ".sandcastle", "main.mts"), "utf-8");
    // Presence check + graceful fallback rather than an unconditional run.
    expect(main).toContain("command -v go >/dev/null 2>&1 && go mod download");
    expect(main).toContain("not found in sandbox");
    expect(main).toContain(".sandcastle/profiles/go.md");
  });

  it("AC: js-ts scaffold main keeps the npm setup hook", async () => {
    const dir = await makeDir();
    await runScaffold(dir, { templateName: "simple-loop" });

    const main = await readFile(join(dir, ".sandcastle", "main.mts"), "utf-8");
    expect(main).toContain('command: "npm install"');
  });

  it("AC: flutter+go scaffold main uses the primary (first) profile setup command", async () => {
    const dir = await makeDir();
    await runScaffold(dir, {
      templateName: "simple-loop",
      profiles: profilesFor("flutter", "go"),
    });

    const main = await readFile(join(dir, ".sandcastle", "main.mts"), "utf-8");
    expect(main).not.toContain('command: "npm install"');
    expect(main).toContain(
      "command -v flutter >/dev/null 2>&1 && flutter pub get",
    );
  });

  // AC (issue #11): Selecting `flutter` scaffolds Flutter-aware guidance and
  // does not scaffold unrelated Go-only guidance.
  it("AC: selecting flutter scaffolds flutter guidance and not go guidance", async () => {
    const dir = await makeDir();
    await runScaffold(dir, { profiles: profilesFor("flutter") });

    expect(await guidanceExists(dir, "flutter")).toBe(true);
    expect(await guidanceExists(dir, "go")).toBe(false);

    const guidance = await readFile(
      join(dir, ".sandcastle", "profiles", "flutter.md"),
      "utf-8",
    );
    expect(guidance).toContain("flutter analyze");
    expect(guidance).toContain("flutter pub get");
  });

  // AC (issue #11): Selecting `go` scaffolds Go-aware guidance and does not
  // scaffold unrelated Flutter-only guidance.
  it("AC: selecting go scaffolds go guidance and not flutter guidance", async () => {
    const dir = await makeDir();
    await runScaffold(dir, { profiles: profilesFor("go") });

    expect(await guidanceExists(dir, "go")).toBe(true);
    expect(await guidanceExists(dir, "flutter")).toBe(false);

    const guidance = await readFile(
      join(dir, ".sandcastle", "profiles", "go.md"),
      "utf-8",
    );
    expect(guidance).toContain("go test ./...");
    expect(guidance).toContain("go mod download");
  });

  // AC (issue #11): Selecting `flutter,go` scaffolds both profile guidance
  // files and generated metadata lists both profiles.
  it("AC: selecting flutter,go scaffolds both guidance files and metadata lists both", async () => {
    const dir = await makeDir();
    await runScaffold(dir, { profiles: profilesFor("flutter", "go") });

    expect(await guidanceExists(dir, "flutter")).toBe(true);
    expect(await guidanceExists(dir, "go")).toBe(true);

    const metadata = await readMetadata(dir);
    expect(metadata.profiles.map((p) => p.name)).toEqual(["flutter", "go"]);
  });

  // AC (issue #11): Planner and reviewer templates reference selected profile
  // guidance consistently.
  it("AC: planner + reviewer prompts all reference the selected profile guidance", async () => {
    const dir = await makeDir();
    await runScaffold(dir, {
      templateName: "parallel-planner-with-review",
      profiles: profilesFor("go"),
    });

    const promptFiles = [
      "plan-prompt.md",
      "implement-prompt.md",
      "review-prompt.md",
      "merge-prompt.md",
    ];
    for (const f of promptFiles) {
      const content = await readFile(join(dir, ".sandcastle", f), "utf-8");
      expect(content).toContain(".sandcastle/profiles/go.md");
      expect(content).toContain("Project profiles");
    }
  });

  // AC (issue #11): CODING_STANDARDS.md is not a prompt file and must not get a
  // profiles section appended.
  it("AC: non-prompt template files are not rewritten with a profiles section", async () => {
    const dir = await makeDir();
    await runScaffold(dir, {
      templateName: "sequential-reviewer",
      profiles: profilesFor("go"),
    });

    const standards = await readFile(
      join(dir, ".sandcastle", "CODING_STANDARDS.md"),
      "utf-8",
    );
    expect(standards).not.toContain("Project profiles");
  });
});
