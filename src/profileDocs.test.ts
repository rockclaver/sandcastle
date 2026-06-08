import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Phase 5 (issue #8) is a documentation phase. These tests pin the
// user/contributor docs so the profile feature stays documented as it evolves.
// Each test name references the acceptance criterion it covers.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

const README = read("README.md");
const CONTRIBUTOR_DOC = read("docs/agents/adding-a-profile.md");
const CONTEXT = read("CONTEXT.md");

describe("profile documentation (issue #8)", () => {
  it("AC: README documents `sandcastle init --profile`, interactive multi-select, and a `--profile flutter,go` example", () => {
    expect(README).toContain("--profile");
    expect(README).toMatch(/--profile\s+flutter,go/);
    expect(README.toLowerCase()).toContain("multi-select");
    // The default-selected profile in the interactive prompt.
    expect(README).toMatch(/js-ts/);
  });

  it("AC: README explains the generated profile guidance files and how agents use them", () => {
    expect(README).toContain(".sandcastle/profiles/");
    expect(README).toContain("profiles.json");
    // How agents consume them: the generated prompt section.
    expect(README).toContain("Project profiles");
  });

  it("AC: contributor docs explain adding an internal profile entry without duplicating workflow templates", () => {
    expect(CONTRIBUTOR_DOC).toContain("PROFILE_REGISTRY");
    expect(CONTRIBUTOR_DOC).toContain("src/InitService.ts");
    // The explicit no-template-duplication rule.
    expect(CONTRIBUTOR_DOC.toLowerCase()).toContain("template");
    expect(CONTRIBUTOR_DOC).toMatch(
      /without (forking|duplicating)|not.*(fork|duplicat)/i,
    );
  });

  it("AC: docs state SDK version pinning and automatic Flutter/Dart/Go installation are out of scope", () => {
    const haystack = (README + CONTRIBUTOR_DOC).toLowerCase();
    expect(haystack).toContain("out of scope");
    expect(haystack).toMatch(/does not install/);
    expect(haystack).toMatch(/pin/);
    for (const sdk of ["flutter", "dart", "go"]) {
      expect(haystack).toContain(sdk);
    }
  });

  it("AC: a patch changeset exists for `@rockclaver/sandcastle`", () => {
    const changesetDir = join(repoRoot, ".changeset");
    const files = readdirSync(changesetDir).filter(
      (f) => f.endsWith(".md") && f !== "README.md",
    );
    const hasPatch = files.some((f) => {
      const body = readFileSync(join(changesetDir, f), "utf8");
      return /"@rockclaver\/sandcastle":\s*patch/.test(body);
    });
    expect(hasPatch).toBe(true);
  });

  it("documents the `Profile` term in CONTEXT.md", () => {
    expect(CONTEXT).toContain("**Profile**");
  });
});
