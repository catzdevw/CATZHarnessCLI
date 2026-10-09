import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "dist", "cli.js");

function run(cwd, ...args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

async function createProject(prefix = "catz-list-") {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

async function initialize(projectDir) {
  const result = run(projectDir, "init");
  assert.equal(result.status, 0, result.stderr);
}

test("list after init reports an empty workspace", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const result = run(projectDir, "harness", "list");

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim(),
      "CATZ Harnesses\n\nNo harnesses installed.\n\nTry:\n  catz harness add presentation",
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("list after adding presentation shows its version and installed status", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const addResult = run(projectDir, "harness", "add", "presentation");
    assert.equal(addResult.status, 0, addResult.stderr);

    const result = run(projectDir, "harness", "list");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^CATZ Harnesses\n\n/m);
    assert.match(result.stdout, /NAME\s+VERSION\s+STATUS/);
    assert.match(result.stdout, /presentation\s+0\.1\.0\s+installed/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("list without catz init fails with the init instruction", async () => {
  const projectDir = await createProject();

  try {
    const result = run(projectDir, "harness", "list");

    assert.equal(result.status, 1);
    assert.equal(
      result.stdout.trim(),
      "CATZ Harness\n\n✗ CATZ workspace not initialized.\n\nRun:\n  catz init",
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("list with an invalid manifest fails without repairing it", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const manifestPath = path.join(projectDir, ".catz", "catz.json");
    const invalidBytes = '{ "version": 1, "harnesses": [] }\n';
    await writeFile(manifestPath, invalidBytes, "utf8");

    const result = run(projectDir, "harness", "list");

    assert.equal(result.status, 1);
    assert.equal(
      result.stdout.trim(),
      "CATZ Harness\n\n✗ Invalid CATZ workspace manifest:\n  .catz/catz.json",
    );
    assert.equal(await readFile(manifestPath, "utf8"), invalidBytes);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("list shows every manifest harness in alphabetical order", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const manifestPath = path.join(projectDir, ".catz", "catz.json");
    const manifest = {
      version: 1,
      harnesses: {
        security: { version: "1.0.0" },
        presentation: { version: "0.1.0" },
        frontend: { version: "2.3.0" },
      },
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const result = run(projectDir, "harness", "list");

    assert.equal(result.status, 0, result.stderr);
    const frontendIndex = result.stdout.indexOf("frontend");
    const presentationIndex = result.stdout.indexOf("presentation");
    const securityIndex = result.stdout.indexOf("security");

    assert.ok(frontendIndex > -1);
    assert.ok(presentationIndex > frontendIndex);
    assert.ok(securityIndex > presentationIndex);
    assert.match(result.stdout, /frontend\s+2\.3\.0\s+installed/);
    assert.match(result.stdout, /presentation\s+0\.1\.0\s+installed/);
    assert.match(result.stdout, /security\s+1\.0\.0\s+installed/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("list is read-only and preserves workspace bytes", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const addResult = run(projectDir, "harness", "add", "presentation");
    assert.equal(addResult.status, 0, addResult.stderr);

    const manifestPath = path.join(projectDir, ".catz", "catz.json");
    const harnessManifestPath = path.join(
      projectDir,
      ".catz",
      "harnesses",
      "presentation",
      "harness.json",
    );
    const manifestBefore = await readFile(manifestPath);
    const harnessBefore = await readFile(harnessManifestPath);

    const result = run(projectDir, "harness", "list");
    assert.equal(result.status, 0, result.stderr);

    const manifestAfter = await readFile(manifestPath);
    const harnessAfter = await readFile(harnessManifestPath);
    assert.deepEqual(manifestAfter, manifestBefore);
    assert.deepEqual(harnessAfter, harnessBefore);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});
