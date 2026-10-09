// @ts-ignore -- resolved by Node.js when the compiled CLI runs.
import path from "node:path";
import type { HarnessDefinition } from "./registry.js";
import { assertSafeCatzPath } from "./security.js";
import {
  ensureDirectory,
  pathExists,
  writeJsonFileIfMissing,
} from "../utils/filesystem.js";

export interface HarnessInstallResult {
  harnessDir: string;
}

export class HarnessInstallConflictError extends Error {
  constructor() {
    super("Harness installation path already exists");
    this.name = "HarnessInstallConflictError";
  }
}

export async function installBuiltinHarness(
  projectDir: string,
  harnessesDir: string,
  harness: HarnessDefinition,
): Promise<HarnessInstallResult> {
  await assertSafeCatzPath(projectDir, harnessesDir, "directory");

  const harnessDir = path.join(harnessesDir, harness.name);
  const harnessManifestPath = path.join(harnessDir, "harness.json");

  await assertSafeCatzPath(projectDir, harnessDir, "directory");
  if (await pathExists(harnessDir)) {
    throw new HarnessInstallConflictError();
  }

  await ensureDirectory(harnessDir);
  await assertSafeCatzPath(projectDir, harnessDir, "directory");
  await assertSafeCatzPath(projectDir, harnessManifestPath, "file");

  const createdManifest = await writeJsonFileIfMissing(harnessManifestPath, {
    name: harness.name,
    displayName: harness.displayName,
    version: harness.version,
    registry: "builtin",
  });

  if (!createdManifest) {
    throw new HarnessInstallConflictError();
  }

  await assertSafeCatzPath(projectDir, harnessManifestPath, "file");
  return { harnessDir };
}
