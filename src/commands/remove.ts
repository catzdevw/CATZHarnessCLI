// @ts-ignore -- resolved by Node.js when the compiled CLI runs.
import path from "node:path";
import {
  InvalidWorkspaceManifestError,
  readWorkspaceManifest,
  unregisterHarness,
  writeWorkspaceManifest,
} from "../core/manifest.js";
import { getCatzPaths } from "../core/paths.js";
import { pathExists, removeDirectory } from "../utils/filesystem.js";

const SAFE_HARNESS_NAME = /^[a-z0-9][a-z0-9-]*$/;

export async function removeCommand(
  name: string,
  projectDir?: string,
): Promise<number> {
  const paths = getCatzPaths(projectDir);

  console.log("CATZ Harness\n");

  if (!(await pathExists(paths.manifestFile))) {
    console.log("✗ CATZ workspace not initialized.\n");
    console.log("Run:");
    console.log("  catz init");
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

  if (!SAFE_HARNESS_NAME.test(name)) {
    console.log(`✗ Invalid harness name: ${name}`);
    return 1;
  }

  if (!isRegistered) {
    console.log(`${name} is not installed.`);
    return 0;
  }

  console.log(`Removing ${name}...\n`);

  const harnessDir = path.join(paths.harnessesDir, name);
  const removedDirectory = await removeDirectory(harnessDir);

  const updatedManifest = unregisterHarness(manifest, name);
  await writeWorkspaceManifest(paths.manifestFile, updatedManifest);

  if (removedDirectory) {
    console.log(`✓ Removed .catz/harnesses/${name}/`);
  } else {
    console.log("✓ Harness directory already absent");
  }

  console.log(`✓ Unregistered ${name}`);
  console.log(`\n${capitalize(name)} harness removed.`);

  return 0;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}
