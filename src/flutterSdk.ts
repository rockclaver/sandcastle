/**
 * Host-side provisioning for a Linux Flutter SDK consumed by bind-mount sandbox
 * providers.
 *
 * The host (often macOS) ships a Flutter SDK whose Dart binary is built for the
 * host OS and cannot execute inside the Linux container. Sandcastle therefore
 * downloads the matching *Linux* Flutter release into a host cache directory and
 * bind-mounts that cache into the container. The download runs on the host —
 * where the network works — instead of inside the Docker build, which is where
 * the original failure happened.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { MountConfig } from "./MountConfig.js";

/** Mount target for the Linux Flutter SDK inside the container. */
export const FLUTTER_SANDBOX_DIR = "/home/agent/flutter";

/** Channel/version used when the host has no Flutter to match. */
const DEFAULT_FLUTTER_VERSION = "3.35.7";
const DEFAULT_FLUTTER_CHANNEL = "stable";

/** Records the provisioned `<version>-<channel>` so re-runs can skip the download. */
const VERSION_STAMP = ".sandcastle-version";

export interface FlutterVersion {
  readonly version: string;
  readonly channel: string;
}

export interface EnsureFlutterOptions {
  /** Override the Flutter version; defaults to the host Flutter, then a baked default. */
  readonly version?: string;
  /** Override the release channel; defaults to the host channel, then `stable`. */
  readonly channel?: string;
  /** Override the host cache directory (primarily a test seam). */
  readonly cacheDir?: string;
  /** Test seam: download `url` to `dest`. Defaults to `curl`. */
  readonly download?: (url: string, dest: string) => void;
  /** Test seam: extract a `.tar.xz` into `destDir`, stripping the leading dir. Defaults to `tar`. */
  readonly extract?: (archive: string, destDir: string) => void;
  /** Test seam: detect the host Flutter version. Defaults to running `flutter --version`. */
  readonly detect?: () => FlutterVersion | undefined;
}

export interface EnsuredFlutter {
  readonly cacheDir: string;
  readonly version: string;
  readonly channel: string;
}

/** Host cache directory holding the provisioned Linux Flutter SDK. */
export const flutterCacheDir = (): string =>
  join(
    process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"),
    "sandcastle",
    "flutter",
  );

/** Parse the first line of `flutter --version` (`Flutter X.Y.Z • channel <ch> • ...`). */
export const parseFlutterVersion = (
  output: string,
): FlutterVersion | undefined => {
  const match =
    /Flutter\s+(\d+\.\d+\.\d+(?:[-+][\w.]+)?)\s+•\s+channel\s+(\S+)/.exec(
      output,
    );
  if (!match?.[1] || !match[2]) return undefined;
  return { version: match[1], channel: match[2] };
};

/** Detect the host Flutter version, or `undefined` when Flutter is not installed. */
export const detectHostFlutterVersion = (): FlutterVersion | undefined => {
  try {
    const out = execFileSync("flutter", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parseFlutterVersion(out);
  } catch {
    return undefined;
  }
};

/** Official Linux release tarball URL for a Flutter version/channel. */
export const flutterTarballUrl = (version: string, channel: string): string =>
  `https://storage.googleapis.com/flutter_infra_release/releases/${channel}/linux/flutter_linux_${version}-${channel}.tar.xz`;

const curlDownload = (url: string, dest: string): void => {
  execFileSync("curl", ["-fSL", "--retry", "3", url, "-o", dest], {
    stdio: ["ignore", "ignore", "inherit"],
  });
};

const tarExtract = (archive: string, destDir: string): void => {
  // The official tarball nests everything under a top-level `flutter/` dir;
  // strip it so the SDK lands directly in destDir.
  execFileSync("tar", ["-xf", archive, "--strip-components=1", "-C", destDir], {
    stdio: ["ignore", "ignore", "inherit"],
  });
};

/**
 * Ensure a Linux Flutter SDK is present in the host cache, downloading it once.
 *
 * Idempotent: a version stamp gates re-downloads, so repeated calls (including
 * the multiple sandbox constructions in the planner templates) are no-ops once
 * the cache matches the desired version.
 */
export const ensureLinuxFlutter = (
  opts: EnsureFlutterOptions = {},
): EnsuredFlutter => {
  const detect = opts.detect ?? detectHostFlutterVersion;
  const host = detect();
  const version = opts.version ?? host?.version ?? DEFAULT_FLUTTER_VERSION;
  const channel = opts.channel ?? host?.channel ?? DEFAULT_FLUTTER_CHANNEL;
  const cacheDir = opts.cacheDir ?? flutterCacheDir();
  const desired = `${version}-${channel}`;

  const stampPath = join(cacheDir, VERSION_STAMP);
  const flutterBin = join(cacheDir, "bin", "flutter");
  const current = existsSync(stampPath)
    ? readFileSync(stampPath, "utf8").trim()
    : undefined;
  if (existsSync(flutterBin) && current === desired) {
    return { cacheDir, version, channel };
  }

  rmSync(cacheDir, { recursive: true, force: true });
  mkdirSync(cacheDir, { recursive: true });

  const archive = join(tmpdir(), `sandcastle-flutter-${desired}.tar.xz`);
  const download = opts.download ?? curlDownload;
  const extract = opts.extract ?? tarExtract;
  download(flutterTarballUrl(version, channel), archive);
  extract(archive, cacheDir);
  rmSync(archive, { force: true });

  writeFileSync(stampPath, desired);
  return { cacheDir, version, channel };
};

/** Bind-mount descriptor exposing the cached SDK inside the container. */
export const flutterSandboxMounts = (cacheDir: string): MountConfig[] => [
  // Read-write: Flutter builds its tool snapshot under bin/cache on first run.
  { hostPath: cacheDir, sandboxPath: FLUTTER_SANDBOX_DIR },
];

/** Env that puts the mounted Flutter SDK on PATH inside the container. */
export const flutterSandboxEnv = (): Record<string, string> => ({
  PATH: `${FLUTTER_SANDBOX_DIR}/bin:/home/agent/.pub-cache/bin:/home/agent/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
  PUB_CACHE: "/home/agent/.pub-cache",
});
