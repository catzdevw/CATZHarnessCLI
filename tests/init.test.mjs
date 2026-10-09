import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "dist", "cli.js");

function runInit(cwd) {
  return execFileSync(process.execPath, [cliPath, "init"], {
    cwd,
    encoding: "utf8",
  });
}

test("catz init creates a workspace and does not overwrite catz.json", async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "catz-init-"));

  try {
    const firstOutput = runInit(projectDir);
    const manifestPath = path.join(projectDir, ".catz", "catz.json");

    assert.match(firstOutput, /✓ Created \.catz\//);
    assert.match(firstOutput, /✓ Created \.catz\/harnesses\//);
    assert.match(firstOutput, /✓ Created \.catz\/catz\.json/);
    assert.match(firstOutput, /CATZ workspace initialized\./);

    const initialManifest = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.deepEqual(initialManifest, { version: 1, harnesses: {} });

    const preservedManifest = `${JSON.stringify(
      {
        version: 1,
        harnesses: { sentinel: { version: "test" } },
      },
      null,
      2,
    )}\n`;

    await writeFile(manifestPath, preservedManifest, "utf8");

    const secondOutput = runInit(projectDir);

    assert.equal(secondOutput.trim(), "CATZ workspace already initialized.");
    assert.equal(await readFile(manifestPath, "utf8"), preservedManifest);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});
