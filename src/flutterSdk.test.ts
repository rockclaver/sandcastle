import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FLUTTER_SANDBOX_DIR,
  ensureLinuxFlutter,
  flutterSandboxEnv,
  flutterSandboxMounts,
  flutterTarballUrl,
  parseFlutterVersion,
  type EnsureFlutterOptions,
} from "./flutterSdk.js";

const dirs: string[] = [];
const makeCacheDir = async () => {
  const d = await mkdtemp(join(tmpdir(), "flutter-sdk-"));
  dirs.push(d);
  return join(d, "flutter");
};

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});

// A fake provisioner that "extracts" a minimal SDK layout so the bin/flutter
// existence check passes without touching the network.
const fakeProvision = (
  cacheDir: string,
): Pick<EnsureFlutterOptions, "download" | "extract"> & {
  downloads: string[];
} => {
  const downloads: string[] = [];
  return {
    downloads,
    download: (url) => {
      downloads.push(url);
    },
    extract: (_archive, destDir) => {
      mkdirSync(join(destDir, "bin"), { recursive: true });
      writeFileSync(join(destDir, "bin", "flutter"), "#!/bin/sh\n");
    },
  };
};

describe("parseFlutterVersion", () => {
  it("parses the first line of `flutter --version`", () => {
    const out =
      "Flutter 3.35.7 • channel stable • https://github.com/flutter/flutter.git\nFramework • revision adc9010625";
    expect(parseFlutterVersion(out)).toEqual({
      version: "3.35.7",
      channel: "stable",
    });
  });

  it("returns undefined for unrelated output", () => {
    expect(parseFlutterVersion("not flutter")).toBeUndefined();
  });
});

describe("flutterTarballUrl", () => {
  it("builds the official Linux release URL", () => {
    expect(flutterTarballUrl("3.35.7", "stable")).toBe(
      "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.35.7-stable.tar.xz",
    );
  });
});

describe("ensureLinuxFlutter", () => {
  it("downloads when the cache is empty and stamps the version", async () => {
    const cacheDir = await makeCacheDir();
    const fake = fakeProvision(cacheDir);

    const result = ensureLinuxFlutter({
      cacheDir,
      detect: () => ({ version: "3.35.7", channel: "stable" }),
      download: fake.download,
      extract: fake.extract,
    });

    expect(result).toEqual({ cacheDir, version: "3.35.7", channel: "stable" });
    expect(fake.downloads).toEqual([flutterTarballUrl("3.35.7", "stable")]);
    expect(existsSync(join(cacheDir, "bin", "flutter"))).toBe(true);
    expect(readFileSync(join(cacheDir, ".sandcastle-version"), "utf8")).toBe(
      "3.35.7-stable",
    );
  });

  it("is a no-op when the stamp already matches", async () => {
    const cacheDir = await makeCacheDir();
    const fake = fakeProvision(cacheDir);
    const opts: EnsureFlutterOptions = {
      cacheDir,
      detect: () => ({ version: "3.35.7", channel: "stable" }),
      download: fake.download,
      extract: fake.extract,
    };

    ensureLinuxFlutter(opts);
    ensureLinuxFlutter(opts);

    expect(fake.downloads).toHaveLength(1);
  });

  it("re-downloads when the desired version changes", async () => {
    const cacheDir = await makeCacheDir();
    const fake = fakeProvision(cacheDir);

    ensureLinuxFlutter({
      cacheDir,
      version: "3.35.7",
      download: fake.download,
      extract: fake.extract,
    });
    ensureLinuxFlutter({
      cacheDir,
      version: "3.36.0",
      download: fake.download,
      extract: fake.extract,
    });

    expect(fake.downloads).toEqual([
      flutterTarballUrl("3.35.7", "stable"),
      flutterTarballUrl("3.36.0", "stable"),
    ]);
    expect(readFileSync(join(cacheDir, ".sandcastle-version"), "utf8")).toBe(
      "3.36.0-stable",
    );
  });

  it("falls back to the baked default when the host has no Flutter", async () => {
    const cacheDir = await makeCacheDir();
    const fake = fakeProvision(cacheDir);

    const result = ensureLinuxFlutter({
      cacheDir,
      detect: () => undefined,
      download: fake.download,
      extract: fake.extract,
    });

    expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result.channel).toBe("stable");
    expect(fake.downloads).toHaveLength(1);
  });
});

describe("flutterSandboxMounts / flutterSandboxEnv", () => {
  it("mounts the cache dir at the sandbox Flutter path (read-write)", () => {
    const mounts = flutterSandboxMounts("/host/cache/flutter");
    expect(mounts).toEqual([
      { hostPath: "/host/cache/flutter", sandboxPath: FLUTTER_SANDBOX_DIR },
    ]);
    // Read-write is required for first-run snapshot builds.
    expect(mounts[0]!.readonly).toBeUndefined();
  });

  it("puts the mounted Flutter bin first on PATH", () => {
    const env = flutterSandboxEnv();
    expect(env.PATH?.startsWith(`${FLUTTER_SANDBOX_DIR}/bin:`)).toBe(true);
    expect(env.PUB_CACHE).toBe("/home/agent/.pub-cache");
  });
});
