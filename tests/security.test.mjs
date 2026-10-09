import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
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

async function createProject(prefix = "catz-security-") {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

async function initialize(projectDir) {
  const result = run(projectDir, "init");
  assert.equal(result.status, 0, result.stderr);
}

async function linkDirectory(target, linkPath) {
  await symlink(
    path.resolve(target),
    linkPath,
    process.platform === "win32" ? "junction" : "dir",
  );
}

async function writeManifest(projectDir, harnesses) {
  const manifestPath = path.join(projectDir, ".catz", "catz.json");
  const bytes = `${JSON.stringify({ version: 1, harnesses }, null, 2)}\n`;
  await writeFile(manifestPath, bytes, "utf8");
  return { manifestPath, bytes };
}

test("init rejects a pre-existing symlinked or junction .catz directory", async () => {
  const projectDir = await createProject();
  const victimDir = await createProject("catz-victim-");

  try {
    const sentinelPath = path.join(victimDir, "important.txt");
    await writeFile(sentinelPath, "keep\n", "utf8");
    await linkDirectory(victimDir, path.join(projectDir, ".catz"));

    const result = run(projectDir, "init");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Unsafe CATZ workspace path detected/);
    assert.equal(await readFile(sentinelPath, "utf8"), "keep\n");
    await assert.rejects(access(path.join(victimDir, "harnesses")));
    await assert.rejects(access(path.join(victimDir, "catz.json")));
  } finally {
    await rm(projectDir, { recursive: true, force: true });
    await rm(victimDir, { recursive: true, force: true });
  }
});

test("add rejects a symlinked or junction harness root and cannot write outside the project", async () => {
  const projectDir = await createProject();
  const victimDir = await createProject("catz-victim-");

  try {
    await initialize(projectDir);
    const harnessRoot = path.join(projectDir, ".catz", "harnesses");
    await rm(harnessRoot, { recursive: true, force: true });
    await linkDirectory(victimDir, harnessRoot);

    const result = run(projectDir, "harness", "add", "presentation");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Unsafe CATZ workspace path detected/);
    await assert.rejects(access(path.join(victimDir, "presentation")));
    const manifest = JSON.parse(
      await readFile(path.join(projectDir, ".catz", "catz.json"), "utf8"),
    );
    assert.deepEqual(manifest, { version: 1, harnesses: {} });
  } finally {
    await rm(projectDir, { recursive: true, force: true });
    await rm(victimDir, { recursive: true, force: true });
  }
});

test("remove rejects a symlinked or junction harness root and cannot delete outside the project", async () => {
  const projectDir = await createProject();
  const victimDir = await createProject("catz-victim-");

  try {
    await initialize(projectDir);
    const { manifestPath, bytes } = await writeManifest(projectDir, {
      presentation: { version: "0.1.0" },
    });

    const victimHarness = path.join(victimDir, "presentation");
    await mkdir(victimHarness, { recursive: true });
    const sentinelPath = path.join(victimHarness, "important.txt");
    await writeFile(sentinelPath, "keep\n", "utf8");

    const harnessRoot = path.join(projectDir, ".catz", "harnesses");
    await rm(harnessRoot, { recursive: true, force: true });
    await linkDirectory(victimDir, harnessRoot);

    const result = run(projectDir, "harness", "remove", "presentation");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Unsafe CATZ workspace path detected/);
    assert.equal(await readFile(sentinelPath, "utf8"), "keep\n");
    assert.equal(await readFile(manifestPath, "utf8"), bytes);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
    await rm(victimDir, { recursive: true, force: true });
  }
});

test("remove rejects a symlinked or junction harness directory", async () => {
  const projectDir = await createProject();
  const victimDir = await createProject("catz-victim-");

  try {
    await initialize(projectDir);
    const { manifestPath, bytes } = await writeManifest(projectDir, {
      presentation: { version: "0.1.0" },
    });
    const sentinelPath = path.join(victimDir, "important.txt");
    await writeFile(sentinelPath, "keep\n", "utf8");

    await linkDirectory(
      victimDir,
      path.join(projectDir, ".catz", "harnesses", "presentation"),
    );

    const result = run(projectDir, "harness", "remove", "presentation");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /containment could not be proven|Unsafe CATZ workspace path detected/);
    assert.equal(await readFile(sentinelPath, "utf8"), "keep\n");
    assert.equal(await readFile(manifestPath, "utf8"), bytes);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
    await rm(victimDir, { recursive: true, force: true });
  }
});

test("doctor detects a symlinked or junction workspace", async () => {
  const projectDir = await createProject();
  const victimDir = await createProject("catz-victim-");

  try {
    await writeFile(
      path.join(victimDir, "catz.json"),
      '{"version":1,"harnesses":{}}\n',
      "utf8",
    );
    await mkdir(path.join(victimDir, "harnesses"));
    await linkDirectory(victimDir, path.join(projectDir, ".catz"));

    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Unsafe CATZ workspace path detected/);
    assert.doesNotMatch(result.stdout, /Everything looks healthy/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
    await rm(victimDir, { recursive: true, force: true });
  }
});

test("doctor detects a symlinked or junction harness root", async () => {
  const projectDir = await createProject();
  const victimDir = await createProject("catz-victim-");

  try {
    await initialize(projectDir);
    const harnessRoot = path.join(projectDir, ".catz", "harnesses");
    await rm(harnessRoot, { recursive: true, force: true });
    await linkDirectory(victimDir, harnessRoot);

    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Unsafe harness directory detected/);
    assert.doesNotMatch(result.stdout, /Everything looks healthy/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
    await rm(victimDir, { recursive: true, force: true });
  }
});

test("doctor detects a symlinked or junction registered harness directory", async () => {
  const projectDir = await createProject();
  const victimDir = await createProject("catz-victim-");

  try {
    await initialize(projectDir);
    await writeManifest(projectDir, {
      presentation: { version: "0.1.0" },
    });
    await linkDirectory(
      victimDir,
      path.join(projectDir, ".catz", "harnesses", "presentation"),
    );

    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /presentation directory is unsafe/);
    assert.doesNotMatch(result.stdout, /Everything looks healthy/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
    await rm(victimDir, { recursive: true, force: true });
  }
});

test("workspace manifest rejects control characters in harness names", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const escape = "\u001b";
    await writeManifest(projectDir, {
      [`evil${escape}[2J`]: { version: "1.0.0" },
    });

    const result = run(projectDir, "harness", "list");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Invalid CATZ workspace manifest/);
    assert.equal(result.stdout.includes(escape), false);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("workspace manifest rejects control characters in harness versions", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    const escape = "\u001b";
    await writeManifest(projectDir, {
      presentation: { version: `0.1.0${escape}[2J` },
    });

    const result = run(projectDir, "harness", "list");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Invalid CATZ workspace manifest/);
    assert.equal(result.stdout.includes(escape), false);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("doctor rejects control characters in harness.json without echoing them", async () => {
  const projectDir = await createProject();

  try {
    await initialize(projectDir);
    await writeManifest(projectDir, {
      presentation: { version: "0.1.0" },
    });
    const harnessDir = path.join(projectDir, ".catz", "harnesses", "presentation");
    await mkdir(harnessDir, { recursive: true });
    const escape = "\u001b";
    await writeFile(
      path.join(harnessDir, "harness.json"),
      `${JSON.stringify({ name: `presentation${escape}[2J`, version: "0.1.0" }, null, 2)}\n`,
      "utf8",
    );

    const result = run(projectDir, "harness", "doctor");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /presentation harness\.json invalid/);
    assert.equal(result.stdout.includes(escape), false);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});
