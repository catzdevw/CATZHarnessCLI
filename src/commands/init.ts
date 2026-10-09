import { getCatzPaths } from "../core/paths.js";
import {
  ensureDirectory,
  writeJsonFileIfMissing,
} from "../utils/filesystem.js";

const INITIAL_MANIFEST = {
  version: 1,
  harnesses: {},
};

export async function initCommand(projectDir?: string): Promise<void> {
  const paths = getCatzPaths(projectDir);

  const createdCatzDir = await ensureDirectory(paths.catzDir);
  const createdHarnessesDir = await ensureDirectory(paths.harnessesDir);
  const createdManifest = await writeJsonFileIfMissing(
    paths.manifestFile,
    INITIAL_MANIFEST,
  );

  if (!createdCatzDir && !createdHarnessesDir && !createdManifest) {
    console.log("CATZ workspace already initialized.");
    return;
  }

  console.log("CATZ Harness\n");

  if (createdCatzDir) {
    console.log("✓ Created .catz/");
  }

  if (createdHarnessesDir) {
    console.log("✓ Created .catz/harnesses/");
  }

  if (createdManifest) {
    console.log("✓ Created .catz/catz.json");
  }

  console.log("\nCATZ workspace initialized.");
}
