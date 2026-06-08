import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { mkdtemp, readFile } from "node:fs/promises";
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
