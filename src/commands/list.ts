import {
  InvalidWorkspaceManifestError,
  readWorkspaceManifest,
} from "../core/manifest.js";
import { getCatzPaths } from "../core/paths.js";
import { assertSafeCatzPath, UnsafeCatzPathError } from "../core/security.js";
import { pathExists } from "../utils/filesystem.js";

const NAME_WIDTH = 15;
const VERSION_WIDTH = 11;

export async function listCommand(projectDir?: string): Promise<number> {
  const paths = getCatzPaths(projectDir);

  try {
    await assertSafeCatzPath(paths.projectDir, paths.catzDir, "directory");
    await assertSafeCatzPath(paths.projectDir, paths.manifestFile, "file");
  } catch (error) {
    if (error instanceof UnsafeCatzPathError) {
      console.log("CATZ Harness\n");
      console.log("✗ Unsafe CATZ workspace path detected.");
      return 1;
    }
    throw error;
  }

  if (!(await pathExists(paths.manifestFile))) {
    console.log("CATZ Harness\n");
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
      console.log("CATZ Harness\n");
      console.log("✗ Invalid CATZ workspace manifest:");
      console.log("  .catz/catz.json");
      return 1;
    }

    throw error;
  }

  const harnesses = Object.entries(manifest.harnesses).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  console.log("CATZ Harnesses\n");

  if (harnesses.length === 0) {
    console.log("No harnesses installed.\n");
    console.log("Try:");
    console.log("  catz harness add presentation");
    return 0;
  }

  console.log(
    `${"NAME".padEnd(NAME_WIDTH)}${"VERSION".padEnd(VERSION_WIDTH)}STATUS`,
  );

  for (const [name, registration] of harnesses) {
    console.log(
      `${name.padEnd(NAME_WIDTH)}${registration.version.padEnd(VERSION_WIDTH)}installed`,
    );
  }

  return 0;
}
