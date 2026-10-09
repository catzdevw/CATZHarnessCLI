import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
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

async function createProject(prefix = "catz-remove-") {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

async function initialize(projectDir) {
  const result = run(projectDir, "init");
  assert.equal(result.status, 0, result.stderr);
}

async function addPresentation(projectDir) {
  const result = run(projectDir, "harness", "add", "presentation");
  assert.equal(result.status, 0, result.stderr);
}

test("normal remove deletes the harness recursively and unregisters it", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    await addPresentation(projectDir);

    const harnessDir = path.join(projectDir, ".catz", "harnesses", "presentation");
    const nestedDir = path.join(harnessDir, "nested", "deeper");
    await mkdir(nestedDir, { recursive: true });
    await writeFile(path.join(nestedDir, "fixture.txt"), "nested fixture\n", "utf8");

    const result = run(projectDir, "harness", "remove", "presentation");

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim(),
      "CATZ Harness\n\nRemoving presentation...\n\n✓ Removed .catz/harnesses/presentation/\n✓ Unregistered presentation\n\nPresentation harness removed.",
    );
    await assert.rejects(access(harnessDir));

    const manifest = JSON.parse(
      await readFile(path.join(projectDir, ".catz", "catz.json"), "utf8"),
    );
    assert.deepEqual(manifest, { version: 1, harnesses: {} });
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("list after remove reports no harnesses installed", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    await addPresentation(projectDir);

    const removeResult = run(projectDir, "harness", "remove", "presentation");
    assert.equal(removeResult.status, 0, removeResult.stderr);

    const listResult = run(projectDir, "harness", "list");
    assert.equal(listResult.status, 0, listResult.stderr);
    assert.equal(
      listResult.stdout.trim(),
      "CATZ Harnesses\n\nNo harnesses installed.\n\nTry:\n  catz harness add presentation",
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("remove is idempotent and the second call makes no modifications", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    await addPresentation(projectDir);

    const manifestPath = path.join(projectDir, ".catz", "catz.json");
    const first = run(projectDir, "harness", "remove", "presentation");
    assert.equal(first.status, 0, first.stderr);

    const manifestBefore = await readFile(manifestPath);
    const second = run(projectDir, "harness", "remove", "presentation");
    const manifestAfter = await readFile(manifestPath);

    assert.equal(second.status, 0, second.stderr);
    assert.equal(
      second.stdout.trim(),
      "CATZ Harness\n\npresentation is not installed.",
    );
    assert.deepEqual(manifestAfter, manifestBefore);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("remove without catz init fails and creates or deletes nothing", async () => {
  const projectDir = await createProject();

  try {
    const sentinelPath = path.join(projectDir, "keep.txt");
    await writeFile(sentinelPath, "keep\n", "utf8");

    const result = run(projectDir, "harness", "remove", "presentation");

    assert.equal(result.status, 1);
    assert.equal(
      result.stdout.trim(),
      "CATZ Harness\n\n✗ CATZ workspace not initialized.\n\nRun:\n  catz init",
    );
    assert.equal(await readFile(sentinelPath, "utf8"), "keep\n");
    await assert.rejects(access(path.join(projectDir, ".catz")));
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("invalid manifest fails without changing manifest bytes or harness files", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    await addPresentation(projectDir);

    const manifestPath = path.join(projectDir, ".catz", "catz.json");
    const harnessManifestPath = path.join(
      projectDir,
      ".catz",
      "harnesses",
      "presentation",
      "harness.json",
    );
    const invalidBytes = '{ this is invalid json }\n';
    const harnessBefore = await readFile(harnessManifestPath);
    await writeFile(manifestPath, invalidBytes, "utf8");

    const result = run(projectDir, "harness", "remove", "presentation");

    assert.equal(result.status, 1);
    assert.equal(
      result.stdout.trim(),
      "CATZ Harness\n\n✗ Invalid CATZ workspace manifest:\n  .catz/catz.json",
    );
    assert.equal(await readFile(manifestPath, "utf8"), invalidBytes);
    assert.deepEqual(await readFile(harnessManifestPath), harnessBefore);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("registered harness with an already-missing directory is still unregistered", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    await addPresentation(projectDir);

    const harnessDir = path.join(projectDir, ".catz", "harnesses", "presentation");
    await rm(harnessDir, { recursive: true, force: true });

    const result = run(projectDir, "harness", "remove", "presentation");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /✓ Harness directory already absent/);
    assert.match(result.stdout, /✓ Unregistered presentation/);

    const manifest = JSON.parse(
      await readFile(path.join(projectDir, ".catz", "catz.json"), "utf8"),
    );
    assert.deepEqual(manifest, { version: 1, harnesses: {} });
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("remove uses the manifest as source of truth and preserves unrelated data", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const manifestPath = path.join(projectDir, ".catz", "catz.json");
    const communityDir = path.join(
      projectDir,
      ".catz",
      "harnesses",
      "community-harness",
    );
    await mkdir(communityDir, { recursive: true });
    await writeFile(path.join(communityDir, "custom.txt"), "community\n", "utf8");
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          version: 1,
          theme: "future-setting",
          nested: { keep: true },
          harnesses: {
            "community-harness": { version: "1.0.0", custom: "remove-me" },
            security: { version: "2.0.0", note: "keep-harness-data" },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = run(projectDir, "harness", "remove", "community-harness");
    assert.equal(result.status, 0, result.stderr);
    await assert.rejects(access(communityDir));

    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.equal(manifest.theme, "future-setting");
    assert.deepEqual(manifest.nested, { keep: true });
    assert.deepEqual(manifest.harnesses, {
      security: { version: "2.0.0", note: "keep-harness-data" },
    });
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("unsafe harness names are rejected without filesystem mutation", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const manifestPath = path.join(projectDir, ".catz", "catz.json");
    const sentinelDir = path.join(projectDir, "DO_NOT_DELETE");
    const sentinelPath = path.join(sentinelDir, "sentinel.txt");
    await mkdir(sentinelDir, { recursive: true });
    await writeFile(sentinelPath, "safe\n", "utf8");

    const unsafeName = "../../DO_NOT_DELETE";
    const manifestBytes = `${JSON.stringify(
      {
        version: 1,
        harnesses: {
          [unsafeName]: { version: "1.0.0" },
        },
      },
      null,
      2,
    )}\n`;
    await writeFile(manifestPath, manifestBytes, "utf8");

    const result = run(projectDir, "harness", "remove", unsafeName);

    assert.equal(result.status, 1);
    assert.equal(
      result.stdout.trim(),
      `CATZ Harness\n\n✗ Invalid harness name: ${unsafeName}`,
    );
    assert.equal(await readFile(sentinelPath, "utf8"), "safe\n");
    assert.equal(await readFile(manifestPath, "utf8"), manifestBytes);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});
