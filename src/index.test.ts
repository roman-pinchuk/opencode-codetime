import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectName, formatProjectName } from "./index.js";

test("buildProjectName uses bracketed opencode suffix", () => {
  assert.equal(
    buildProjectName("/tmp/opencode-codetime"),
    "opencode-codetime [opencode]",
  );
});

test("formatProjectName leaves bracketed names unchanged", () => {
  assert.equal(
    formatProjectName("opencode-codetime [opencode]"),
    "opencode-codetime [opencode]",
  );
});
