import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectRepositoryProfiles,
  getProfile,
  getProfileMismatchWarning,
} from "./InitService.js";

const makeDir = () => mkdtemp(join(tmpdir(), "repo-detection-"));

const writeFixture = async (repoDir: string, file: string, content = "") => {
  const path = join(repoDir, file);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
};

const detectNames = async (repoDir: string): Promise<string[]> => {
  const detection = await Effect.runPromise(
    detectRepositoryProfiles(repoDir).pipe(
      Effect.provide(NodeFileSystem.layer),
    ),
  );
  return detection.profiles.map((p) => p.name);
};

const detectionFor = (...names: string[]) => ({
  profiles: names.map((name) => getProfile(name)!),
});

const selectedProfiles = (...names: string[]) =>
  names.map((name) => getProfile(name)!);

describe("Repository profile detection", () => {
  it("AC: detects JS/TS repository signals from package.json", async () => {
    const dir = await makeDir();
    await writeFixture(dir, "package.json", "{}\n");

    await expect(detectNames(dir)).resolves.toEqual(["js-ts"]);
  });

  it.each([
    "bun.lockb",
    "bun.lock",
    "pnpm-lock.yaml",
    "yarn.lock",
    "package-lock.json",
  ])(
    "AC: detects JS/TS repository signals from supported lockfile %s",
    async (lockfile) => {
      const dir = await makeDir();
      await writeFixture(dir, lockfile);

      await expect(detectNames(dir)).resolves.toEqual(["js-ts"]);
    },
  );

  it("AC: detects Flutter repository signals from pubspec.yaml with Flutter markers", async () => {
    const dir = await makeDir();
    await writeFixture(
      dir,
      "pubspec.yaml",
      `name: app
dependencies:
  flutter:
    sdk: flutter
flutter:
  uses-material-design: true
`,
    );

    await expect(detectNames(dir)).resolves.toEqual(["flutter"]);
  });

  it("AC: detects standalone Dart repository signals from pubspec.yaml without Flutter markers", async () => {
    const dir = await makeDir();
    await writeFixture(
      dir,
      "pubspec.yaml",
      `name: package
dependencies:
  path: ^1.9.0
`,
    );

    await expect(detectNames(dir)).resolves.toEqual(["dart"]);
  });

  it("AC: detects Go repository signals from go.mod", async () => {
    const dir = await makeDir();
    await writeFixture(dir, "go.mod", "module example.com/app\n");

    await expect(detectNames(dir)).resolves.toEqual(["go"]);
  });

  it("AC: detects a mixed Flutter plus Go repository", async () => {
    const dir = await makeDir();
    await writeFixture(dir, "go.mod", "module example.com/app\n");
    await writeFixture(
      dir,
      "pubspec.yaml",
      `name: app
dependencies:
  flutter:
    sdk: flutter
`,
    );

    await expect(detectNames(dir)).resolves.toEqual(["flutter", "go"]);
  });

  it("AC: matching selected profiles produce no mismatch warning", () => {
    expect(
      getProfileMismatchWarning(
        selectedProfiles("flutter", "go"),
        detectionFor("flutter", "go"),
      ),
    ).toBeUndefined();
  });

  it("AC: selected profiles that are present in a mixed repository produce no mismatch warning", () => {
    expect(
      getProfileMismatchWarning(
        selectedProfiles("go"),
        detectionFor("flutter", "go"),
      ),
    ).toBeUndefined();
  });

  it("AC: mismatching selected profiles produce warning-only feedback text", () => {
    expect(
      getProfileMismatchWarning(selectedProfiles("go"), detectionFor("js-ts")),
    ).toContain("did not match detected repository profile");
  });

  it("AC: custom layouts with no detected signals produce no mismatch warning", () => {
    expect(
      getProfileMismatchWarning(selectedProfiles("go"), detectionFor()),
    ).toBeUndefined();
  });
});
