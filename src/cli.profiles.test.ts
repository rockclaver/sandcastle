import { afterEach, describe, expect, it, vi } from "vitest";

const clackMocks = vi.hoisted(() => ({
  multiselect: vi.fn(),
  isCancel: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  intro: vi.fn(),
  note: vi.fn(),
  log: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    step: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  taskLog: vi.fn(() => ({
    message: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("@clack/prompts", () => clackMocks);

import { DEFAULT_PROFILE_NAME, listProfiles } from "./InitService.js";
import { promptForProfiles, resolveProfileFlagEntries } from "./cli.js";

describe("init profile CLI helpers", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("AC: interactive init offers multi-select profile selection with js-ts selected initially", async () => {
    clackMocks.multiselect.mockResolvedValue(["js-ts"]);

    await promptForProfiles(listProfiles());

    expect(clackMocks.multiselect).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("project profiles"),
        initialValues: [DEFAULT_PROFILE_NAME],
        required: true,
        options: expect.arrayContaining([
          expect.objectContaining({
            value: "js-ts",
            label: "JavaScript / TypeScript",
          }),
          expect.objectContaining({
            value: "go",
            label: "Go",
          }),
        ]),
      }),
    );
  });

  it("AC: profile flag parsing preserves first occurrence order after de-duping", () => {
    expect(
      resolveProfileFlagEntries("go,js-ts,go,flutter").map((p) => p.name),
    ).toEqual(["go", "js-ts", "flutter"]);
  });
});
