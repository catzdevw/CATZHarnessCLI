// @ts-ignore -- resolved by Node.js when the compiled CLI runs.
import path from "node:path";
import {
  InvalidWorkspaceManifestError,
  readWorkspaceManifest,
  SAFE_HARNESS_NAME,
  unregisterHarness,
  writeWorkspaceManifest,
} from "../core/manifest.js";
import { getCatzPaths } from "../core/paths.js";
import { assertSafeCatzPath, UnsafeCatzPathError } from "../core/security.js";
import { pathExists, removeDirectory } from "../utils/filesystem.js";

export async function removeCommand(
  name: string,
  projectDir?: string,
): Promise<number> {
  const paths = getCatzPaths(projectDir);

  console.log("CATZ Harness\n");

  try {
    await assertSafeCatzPath(paths.projectDir, paths.catzDir, "directory");
    await assertSafeCatzPath(paths.projectDir, paths.manifestFile, "file");
    await assertSafeCatzPath(paths.projectDir, paths.harnessesDir, "directory");
  } catch (error) {
    if (error instanceof UnsafeCatzPathError) {
      return rejectUnsafeWorkspace();
    }
    throw error;
  }

  if (!(await pathExists(paths.manifestFile))) {
    console.log("✗ CATZ workspace not initialized.\n");
    console.log("Run:");
    console.log("  catz init");
    return 1;
  }

  if (!SAFE_HARNESS_NAME.test(name)) {
    console.log(`✗ Invalid harness name: ${name}`);
    return 1;
  }

  let manifest;

  try {
    manifest = await readWorkspaceManifest(paths.manifestFile);
  } catch (error) {
    if (error instanceof InvalidWorkspaceManifestError) {
      console.log("✗ Invalid CATZ workspace manifest:");
      console.log("  .catz/catz.json");
      return 1;
    }

    throw error;
  }

  const isRegistered = Object.prototype.hasOwnProperty.call(
    manifest.harnesses,
    name,
  );

  if (!isRegistered) {
    console.log(`${name} is not installed.`);
    return 0;
  }

  console.log(`Removing ${name}...\n`);

  const harnessDir = path.join(paths.harnessesDir, name);

  try {
    await assertSafeCatzPath(paths.projectDir, paths.harnessesDir, "directory");
    await assertSafeCatzPath(paths.projectDir, harnessDir, "directory");
    const removedDirectory = await removeDirectory(harnessDir);

    await assertSafeCatzPath(paths.projectDir, paths.manifestFile, "file");
    const updatedManifest = unregisterHarness(manifest, name);
    await writeWorkspaceManifest(paths.manifestFile, updatedManifest);
    await assertSafeCatzPath(paths.projectDir, paths.manifestFile, "file");

    if (removedDirectory) {
      console.log(`✓ Removed .catz/harnesses/${name}/`);
    } else {
      console.log("✓ Harness directory already absent");
    }
  } catch (error) {
    if (error instanceof UnsafeCatzPathError) {
      return rejectUnsafeWorkspace();
    }
    throw error;
  }

  console.log(`✓ Unregistered ${name}`);
  console.log(`\n${capitalize(name)} harness removed.`);

  return 0;
}

function rejectUnsafeWorkspace(): number {
  console.log("✗ Unsafe CATZ workspace path detected.");
  console.log("CATZ refused to delete or modify files because containment could not be proven.");
  return 1;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}
