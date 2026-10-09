import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
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

async function createProject(prefix = "catz-add-") {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

async function initialize(projectDir) {
  const result = run(projectDir, "init");
  assert.equal(result.status, 0, result.stderr);
}

test("add presentation installs fixture metadata and registers the harness", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);

    const result = run(projectDir, "harness", "add", "presentation");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Installing presentation\.\.\./);
    assert.match(result.stdout, /✓ Resolved CATZ PowerPoint Presentation Harness/);
    assert.match(result.stdout, /✓ Version 0\.1\.0/);
    assert.match(result.stdout, /✓ Created \.catz\/harnesses\/presentation\//);
    assert.match(result.stdout, /✓ Registered presentation/);
    assert.match(result.stdout, /Presentation harness installed\./);

    const harnessDir = path.join(projectDir, ".catz", "harnesses", "presentation");
    await access(harnessDir);

    const harnessManifest = JSON.parse(
      await readFile(path.join(harnessDir, "harness.json"), "utf8"),
    );
    assert.deepEqual(harnessManifest, {
      name: "presentation",
      displayName: "CATZ PowerPoint Presentation Harness",
      version: "0.1.0",
      registry: "builtin",
    });

    const workspaceManifest = JSON.parse(
      await readFile(path.join(projectDir, ".catz", "catz.json"), "utf8"),
    );
    assert.deepEqual(workspaceManifest, {
      version: 1,
      harnesses: {
        presentation: { version: "0.1.0" },
      },
    });
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("add presentation twice does not overwrite existing files", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const first = run(projectDir, "harness", "add", "presentation");
    assert.equal(first.status, 0, first.stderr);

    const harnessManifestPath = path.join(
      projectDir,
      ".catz",
      "harnesses",
      "presentation",
      "harness.json",
    );
    const workspaceManifestPath = path.join(projectDir, ".catz", "catz.json");

    const customHarnessBytes = '{"sentinel":"keep-harness"}\n';
    await writeFile(harnessManifestPath, customHarnessBytes, "utf8");

    const workspaceBefore = await readFile(workspaceManifestPath, "utf8");
    const second = run(projectDir, "harness", "add", "presentation");

    assert.equal(second.status, 0, second.stderr);
    assert.equal(second.stdout.trim(), "CATZ Harness\n\npresentation is already installed.");
    assert.equal(await readFile(harnessManifestPath, "utf8"), customHarnessBytes);
    assert.equal(await readFile(workspaceManifestPath, "utf8"), workspaceBefore);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("add unknown harness fails cleanly", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const result = run(projectDir, "harness", "add", "banana");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /✗ Unknown harness: banana/);
    assert.match(result.stdout, /Available harnesses:\n  presentation/);

    const manifest = JSON.parse(
      await readFile(path.join(projectDir, ".catz", "catz.json"), "utf8"),
    );
    assert.deepEqual(manifest, { version: 1, harnesses: {} });
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("add without catz init fails without creating workspace files", async () => {
  const projectDir = await createProject();

  try {
    const result = run(projectDir, "harness", "add", "presentation");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /✗ CATZ workspace not initialized\./);
    assert.match(result.stdout, /Run:\n  catz init/);

    await assert.rejects(access(path.join(projectDir, ".catz")));
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("invalid catz.json fails without modifying workspace", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const manifestPath = path.join(projectDir, ".catz", "catz.json");
    const invalidBytes = '{ this is not valid json }\n';
    await writeFile(manifestPath, invalidBytes, "utf8");

    const result = run(projectDir, "harness", "add", "presentation");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /✗ Invalid CATZ workspace manifest:/);
    assert.match(result.stdout, /  \.catz\/catz\.json/);
    assert.equal(await readFile(manifestPath, "utf8"), invalidBytes);
    await assert.rejects(
      access(path.join(projectDir, ".catz", "harnesses", "presentation")),
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("add presentation preserves unrelated manifest data", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const manifestPath = path.join(projectDir, ".catz", "catz.json");
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          version: 1,
          harnesses: {
            existing: { version: "9.9.9", note: "keep-harness-data" },
          },
          futureSetting: "keep-me",
          nested: { preserved: true },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = run(projectDir, "harness", "add", "presentation");
    assert.equal(result.status, 0, result.stderr);

    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.equal(manifest.futureSetting, "keep-me");
    assert.deepEqual(manifest.nested, { preserved: true });
    assert.deepEqual(manifest.harnesses.existing, {
      version: "9.9.9",
      note: "keep-harness-data",
    });
    assert.deepEqual(manifest.harnesses.presentation, { version: "0.1.0" });
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});
