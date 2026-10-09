import { getCatzPaths } from "../core/paths.js";
import { assertSafeCatzPath, UnsafeCatzPathError } from "../core/security.js";
import {
  ensureDirectory,
  writeJsonFileIfMissing,
} from "../utils/filesystem.js";

const INITIAL_MANIFEST = {
  version: 1,
  harnesses: {},
};

export async function initCommand(projectDir?: string): Promise<number> {
  const paths = getCatzPaths(projectDir);

  try {
    await assertSafeCatzPath(paths.projectDir, paths.catzDir, "directory");
    const createdCatzDir = await ensureDirectory(paths.catzDir);

    await assertSafeCatzPath(paths.projectDir, paths.catzDir, "directory");
    await assertSafeCatzPath(paths.projectDir, paths.harnessesDir, "directory");
    const createdHarnessesDir = await ensureDirectory(paths.harnessesDir);

    await assertSafeCatzPath(paths.projectDir, paths.harnessesDir, "directory");
    await assertSafeCatzPath(paths.projectDir, paths.manifestFile, "file");
    const createdManifest = await writeJsonFileIfMissing(
      paths.manifestFile,
      INITIAL_MANIFEST,
    );

    await assertSafeCatzPath(paths.projectDir, paths.manifestFile, "file");

    if (!createdCatzDir && !createdHarnessesDir && !createdManifest) {
      console.log("CATZ workspace already initialized.");
      return 0;
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
    return 0;
  } catch (error) {
    if (error instanceof UnsafeCatzPathError) {
      console.log("CATZ Harness\n");
      console.log("✗ Unsafe CATZ workspace path detected.");
      console.log("CATZ refused to create or modify workspace files.");
      return 1;
    }

    throw error;
  }
}
