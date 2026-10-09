// @ts-ignore -- resolved by Node.js when the compiled CLI runs.
import { readFile, stat } from "node:fs/promises";
// @ts-ignore -- resolved by Node.js when the compiled CLI runs.
import path from "node:path";
import {
  InvalidWorkspaceManifestError,
  readWorkspaceManifest,
  SAFE_HARNESS_NAME,
  SAFE_VERSION,
} from "./manifest.js";
import { getCatzPaths } from "./paths.js";
import { inspectSafeCatzPath } from "./security.js";
import { pathExists } from "../utils/filesystem.js";

declare const process: {
  version: string;
};

const MINIMUM_NODE_MAJOR = 20;

export type DoctorCheckStatus = "success" | "problem";
export type DoctorStage =
  | "runtime"
  | "workspace"
  | "manifest"
  | "harness-root"
  | "harnesses";

export interface DoctorCheck {
  status: DoctorCheckStatus;
  code: string;
  message: string;
  details?: string[];
  harness?: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  problems: number;
  harnessCount: number;
  stage: DoctorStage;
}

export interface InstalledHarnessManifest {
  name: string;
  version: string;
  [key: string]: unknown;
}

export interface DoctorOptions {
  projectDir?: string;
  nodeVersion?: string;
}

export async function inspectDoctor(
  options: DoctorOptions = {},
): Promise<DoctorReport> {
  const nodeVersion = options.nodeVersion ?? process.version;
  const checks: DoctorCheck[] = [];

  const nodeMajor = parseNodeMajor(nodeVersion);
  if (nodeMajor === null || nodeMajor < MINIMUM_NODE_MAJOR) {
    checks.push({
      status: "problem",
      code: "unsupported_node_runtime",
      message: `Unsupported Node.js runtime: ${nodeVersion}`,
      details: ["  CATZ Harness CLI requires Node.js >=20"],
    });
    return createReport(checks, 0, "runtime");
  }

  checks.push({
    status: "success",
    code: "node_runtime_supported",
    message: "Node.js runtime supported",
  });

  const paths = getCatzPaths(options.projectDir);

  const catzSafety = await inspectSafeCatzPath(
    paths.projectDir,
    paths.catzDir,
    "directory",
  );
  if (!catzSafety.safe) {
    checks.push({
      status: "problem",
      code: "workspace_path_unsafe",
      message: "Unsafe CATZ workspace path detected",
      details: [`  ${catzSafety.reason ?? "workspace containment could not be proven"}`],
    });
    return createReport(checks, 0, "workspace");
  }

  const manifestSafety = await inspectSafeCatzPath(
    paths.projectDir,
    paths.manifestFile,
    "file",
  );
  if (!manifestSafety.safe) {
    checks.push({
      status: "problem",
      code: "workspace_manifest_path_unsafe",
      message: "Unsafe CATZ workspace manifest path detected",
      details: [`  ${manifestSafety.reason ?? "manifest containment could not be proven"}`],
    });
    return createReport(checks, 0, "workspace");
  }

  const catzDirectoryFound = await isDirectory(paths.catzDir);
  const manifestFound = await pathExists(paths.manifestFile);

  if (!catzDirectoryFound || !manifestFound) {
    checks.push({
      status: "problem",
      code: "workspace_not_initialized",
      message: "CATZ workspace not initialized.",
      details: ["", "Run:", "  catz init"],
    });
    return createReport(checks, 0, "workspace");
  }

  checks.push({
    status: "success",
    code: "workspace_found",
    message: "CATZ workspace found",
  });

  let manifest;
  try {
    manifest = await readWorkspaceManifest(paths.manifestFile);
  } catch (error) {
    if (error instanceof InvalidWorkspaceManifestError) {
      checks.push({
        status: "problem",
        code: "workspace_manifest_invalid",
        message: "Invalid CATZ workspace manifest:",
        details: ["  .catz/catz.json"],
      });
      return createReport(checks, 0, "manifest");
    }

    throw error;
  }

  checks.push({
    status: "success",
    code: "workspace_manifest_valid",
    message: "catz.json valid",
  });

  const harnessRootSafety = await inspectSafeCatzPath(
    paths.projectDir,
    paths.harnessesDir,
    "directory",
  );
  if (!harnessRootSafety.safe) {
    checks.push({
      status: "problem",
      code: "harness_root_unsafe",
      message: "Unsafe harness directory detected",
      details: [`  ${harnessRootSafety.reason ?? "harness containment could not be proven"}`],
    });
    return createReport(
      checks,
      Object.keys(manifest.harnesses).length,
      "harness-root",
    );
  }

  if (!(await isDirectory(paths.harnessesDir))) {
    checks.push({
      status: "problem",
      code: "harness_root_missing",
      message: "Missing harness directory:",
      details: ["  .catz/harnesses/"],
    });
    return createReport(
      checks,
      Object.keys(manifest.harnesses).length,
      "harness-root",
    );
  }

  checks.push({
    status: "success",
    code: "harness_root_found",
    message: "Harness directory found",
  });

  const harnessEntries = Object.entries(manifest.harnesses).sort(
    ([left], [right]) => left.localeCompare(right),
  );

  for (const [name, registration] of harnessEntries) {
    const harnessDir = path.join(paths.harnessesDir, name);
    const harnessManifestPath = path.join(harnessDir, "harness.json");

    const harnessDirSafety = await inspectSafeCatzPath(
      paths.projectDir,
      harnessDir,
      "directory",
    );
    if (!harnessDirSafety.safe) {
      checks.push({
        status: "problem",
        code: "harness_directory_unsafe",
        message: `${name} directory is unsafe`,
        details: [`  ${harnessDirSafety.reason ?? "containment could not be proven"}`],
        harness: name,
      });
      continue;
    }

    if (!(await isDirectory(harnessDir))) {
      checks.push({
        status: "problem",
        code: "harness_directory_missing",
        message: `${name} directory missing`,
        details: [`  Expected: .catz/harnesses/${name}/`],
        harness: name,
      });
      continue;
    }

    checks.push({
      status: "success",
      code: "harness_directory_found",
      message: `${name} directory found`,
      harness: name,
    });

    const harnessManifestSafety = await inspectSafeCatzPath(
      paths.projectDir,
      harnessManifestPath,
      "file",
    );
    if (!harnessManifestSafety.safe) {
      checks.push({
        status: "problem",
        code: "harness_manifest_path_unsafe",
        message: `${name} harness.json path is unsafe`,
        details: [`  ${harnessManifestSafety.reason ?? "containment could not be proven"}`],
        harness: name,
      });
      continue;
    }

    if (!(await pathExists(harnessManifestPath))) {
      checks.push({
        status: "problem",
        code: "harness_manifest_missing",
        message: `${name} harness.json missing`,
        details: [`  Expected: .catz/harnesses/${name}/harness.json`],
        harness: name,
      });
      continue;
    }

    const installedManifest = await readInstalledHarnessManifest(
      harnessManifestPath,
    );

    if (!installedManifest) {
      checks.push({
        status: "problem",
        code: "harness_manifest_invalid",
        message: `${name} harness.json invalid`,
        harness: name,
      });
      continue;
    }

    checks.push({
      status: "success",
      code: "harness_manifest_valid",
      message: `${name} harness.json valid`,
      harness: name,
    });

    if (installedManifest.name !== name) {
      checks.push({
        status: "problem",
        code: "harness_name_mismatch",
        message: `${name} name mismatch`,
        details: [`  harness.json says: ${installedManifest.name}`],
        harness: name,
      });
    }

    if (installedManifest.version !== registration.version) {
      checks.push({
        status: "problem",
        code: "harness_version_mismatch",
        message: `${name} version mismatch`,
        details: [
          `  Workspace: ${registration.version}`,
          `  Harness:   ${installedManifest.version}`,
        ],
        harness: name,
      });
    } else {
      checks.push({
        status: "success",
        code: "harness_version_matches",
        message: `${name} version matches workspace`,
        harness: name,
      });
    }
  }

  return createReport(checks, harnessEntries.length, "harnesses");
}

async function readInstalledHarnessManifest(
  manifestPath: string,
): Promise<InstalledHarnessManifest | null> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  if (
    typeof parsed.name !== "string" ||
    typeof parsed.version !== "string" ||
    !SAFE_HARNESS_NAME.test(parsed.name) ||
    !SAFE_VERSION.test(parsed.version)
  ) {
    return null;
  }

  return parsed as InstalledHarnessManifest;
}

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    return (await stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNodeMajor(version: string): number | null {
  const match = /^v?(\d+)/.exec(version);
  if (!match) {
    return null;
  }

  const major = Number.parseInt(match[1], 10);
  return Number.isNaN(major) ? null : major;
}

function createReport(
  checks: DoctorCheck[],
  harnessCount: number,
  stage: DoctorStage,
): DoctorReport {
  return {
    checks,
    problems: checks.filter((check) => check.status === "problem").length,
    harnessCount,
    stage,
  };
}
