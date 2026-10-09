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
import { inspectDoctor } from "../dist/core/doctor.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "dist", "cli.js");

function run(cwd, ...args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

async function createProject(prefix = "catz-doctor-") {
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

async function writeWorkspaceManifest(projectDir, manifest) {
  const manifestPath = path.join(projectDir, ".catz", "catz.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifestPath;
}

async function writeHarnessManifest(projectDir, name, manifest) {
  const harnessDir = path.join(projectDir, ".catz", "harnesses", name);
  await mkdir(harnessDir, { recursive: true });
  const manifestPath = path.join(harnessDir, "harness.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifestPath;
}

test("doctor after init reports a healthy empty workspace", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim(),
      [
        "CATZ Doctor",
        "",
        "✓ Node.js runtime supported",
        "✓ CATZ workspace found",
        "✓ catz.json valid",
        "✓ Harness directory found",
        "",
        "No harnesses installed.",
        "",
        "Everything looks healthy.",
      ].join("\n"),
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("doctor reports a healthy presentation installation", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    await addPresentation(projectDir);

    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /✓ Node\.js runtime supported/);
    assert.match(result.stdout, /✓ CATZ workspace found/);
    assert.match(result.stdout, /✓ catz\.json valid/);
    assert.match(result.stdout, /✓ Harness directory found/);
    assert.match(result.stdout, /✓ presentation directory found/);
    assert.match(result.stdout, /✓ presentation harness\.json valid/);
    assert.match(result.stdout, /✓ presentation version matches workspace/);
    assert.match(result.stdout, /Everything looks healthy\./);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("doctor without catz init exits 1 without mutation", async () => {
  const projectDir = await createProject();

  try {
    const sentinelPath = path.join(projectDir, "keep.txt");
    await writeFile(sentinelPath, "keep\n", "utf8");

    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /✗ CATZ workspace not initialized\./);
    assert.match(result.stdout, /Run:\n  catz init/);
    assert.equal(await readFile(sentinelPath, "utf8"), "keep\n");
    await assert.rejects(access(path.join(projectDir, ".catz")));
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("doctor rejects an invalid workspace manifest without modifying it", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const manifestPath = path.join(projectDir, ".catz", "catz.json");
    const invalidBytes = '{ "version": 1, "harnesses": [] }\n';
    await writeFile(manifestPath, invalidBytes, "utf8");

    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /✗ Invalid CATZ workspace manifest:/);
    assert.match(result.stdout, /  \.catz\/catz\.json/);
    assert.equal(await readFile(manifestPath, "utf8"), invalidBytes);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("doctor detects a missing harness root and does not recreate it", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const harnessesDir = path.join(projectDir, ".catz", "harnesses");
    await rm(harnessesDir, { recursive: true, force: true });

    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /✗ Missing harness directory:/);
    assert.match(result.stdout, /  \.catz\/harnesses\//);
    await assert.rejects(access(harnessesDir));
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("doctor detects a registered harness directory that is missing", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    await addPresentation(projectDir);
    const harnessDir = path.join(projectDir, ".catz", "harnesses", "presentation");
    await rm(harnessDir, { recursive: true, force: true });

    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /✗ presentation directory missing/);
    assert.match(result.stdout, /Expected: \.catz\/harnesses\/presentation\//);
    assert.match(result.stdout, /1 problem found\./);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("doctor detects a missing harness.json", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    await addPresentation(projectDir);
    const harnessManifestPath = path.join(
      projectDir,
      ".catz",
      "harnesses",
      "presentation",
      "harness.json",
    );
    await rm(harnessManifestPath);

    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /✓ presentation directory found/);
    assert.match(result.stdout, /✗ presentation harness\.json missing/);
    assert.match(
      result.stdout,
      /Expected: \.catz\/harnesses\/presentation\/harness\.json/,
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("doctor rejects invalid harness.json JSON and invalid structure", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    await addPresentation(projectDir);
    const harnessManifestPath = path.join(
      projectDir,
      ".catz",
      "harnesses",
      "presentation",
      "harness.json",
    );

    await writeFile(harnessManifestPath, "{ invalid json }\n", "utf8");
    const invalidJsonResult = run(projectDir, "harness", "doctor");
    assert.equal(invalidJsonResult.status, 1);
    assert.match(invalidJsonResult.stdout, /✗ presentation harness\.json invalid/);

    await writeFile(
      harnessManifestPath,
      `${JSON.stringify({ name: 123, version: "0.1.0" }, null, 2)}\n`,
      "utf8",
    );
    const invalidStructureResult = run(projectDir, "harness", "doctor");
    assert.equal(invalidStructureResult.status, 1);
    assert.match(
      invalidStructureResult.stdout,
      /✗ presentation harness\.json invalid/,
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("doctor detects a harness name mismatch", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    await addPresentation(projectDir);
    const harnessManifestPath = path.join(
      projectDir,
      ".catz",
      "harnesses",
      "presentation",
      "harness.json",
    );
    await writeFile(
      harnessManifestPath,
      `${JSON.stringify({ name: "security", version: "0.1.0" }, null, 2)}\n`,
      "utf8",
    );

    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /✗ presentation name mismatch/);
    assert.match(result.stdout, /  harness\.json says: security/);
    assert.match(result.stdout, /✓ presentation version matches workspace/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("doctor detects a harness version mismatch", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    await addPresentation(projectDir);
    const harnessManifestPath = path.join(
      projectDir,
      ".catz",
      "harnesses",
      "presentation",
      "harness.json",
    );
    await writeFile(
      harnessManifestPath,
      `${JSON.stringify({ name: "presentation", version: "0.2.0" }, null, 2)}\n`,
      "utf8",
    );

    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /✗ presentation version mismatch/);
    assert.match(result.stdout, /  Workspace: 0\.1\.0/);
    assert.match(result.stdout, /  Harness:   0\.2\.0/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("doctor is byte-for-byte read-only", async () => {
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
    const manifestBefore = await readFile(manifestPath);
    const harnessBefore = await readFile(harnessManifestPath);

    const result = run(projectDir, "harness", "doctor");
    assert.equal(result.status, 0, result.stderr);

    assert.deepEqual(await readFile(manifestPath), manifestBefore);
    assert.deepEqual(await readFile(harnessManifestPath), harnessBefore);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("doctor reports all registered harness problems in alphabetical order", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    await writeWorkspaceManifest(projectDir, {
      version: 1,
      harnesses: {
        security: { version: "1.2.0" },
        presentation: { version: "0.1.0" },
        frontend: { version: "2.0.0" },
      },
    });

    const presentationDir = path.join(
      projectDir,
      ".catz",
      "harnesses",
      "presentation",
    );
    await mkdir(presentationDir, { recursive: true });
    await writeFile(
      path.join(presentationDir, "harness.json"),
      "{ invalid json }\n",
      "utf8",
    );

    await writeHarnessManifest(projectDir, "security", {
      name: "security",
      version: "1.1.0",
    });

    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 1);
    const frontendIndex = result.stdout.indexOf("frontend directory missing");
    const presentationIndex = result.stdout.indexOf("presentation directory found");
    const securityIndex = result.stdout.indexOf("security directory found");
    assert.ok(frontendIndex > -1);
    assert.ok(presentationIndex > frontendIndex);
    assert.ok(securityIndex > presentationIndex);
    assert.match(result.stdout, /✗ frontend directory missing/);
    assert.match(result.stdout, /✗ presentation harness\.json invalid/);
    assert.match(result.stdout, /✗ security version mismatch/);
    assert.match(result.stdout, /3 problems found\./);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("doctor validates a community harness without consulting the built-in registry", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    await writeWorkspaceManifest(projectDir, {
      version: 1,
      harnesses: {
        "community-harness": { version: "1.4.0" },
      },
    });
    await writeHarnessManifest(projectDir, "community-harness", {
      name: "community-harness",
      version: "1.4.0",
      author: "someone",
      custom: true,
    });

    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /✓ community-harness directory found/);
    assert.match(result.stdout, /✓ community-harness harness\.json valid/);
    assert.match(
      result.stdout,
      /✓ community-harness version matches workspace/,
    );
    assert.match(result.stdout, /Everything looks healthy\./);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("doctor core reports an unsupported Node.js runtime", async () => {
  const report = await inspectDoctor({ nodeVersion: "v18.20.0" });

  assert.equal(report.stage, "runtime");
  assert.equal(report.problems, 1);
  assert.deepEqual(report.checks, [
    {
      status: "problem",
      code: "unsupported_node_runtime",
      message: "Unsupported Node.js runtime: v18.20.0",
      details: ["  CATZ Harness CLI requires Node.js >=20"],
    },
  ]);
});
