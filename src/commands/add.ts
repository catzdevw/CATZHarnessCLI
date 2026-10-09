import { installBuiltinHarness, HarnessInstallConflictError } from "../core/installer.js";
import {
  InvalidWorkspaceManifestError,
  readWorkspaceManifest,
  registerHarness,
  writeWorkspaceManifest,
} from "../core/manifest.js";
import { getCatzPaths } from "../core/paths.js";
import { listAvailableHarnesses, resolveHarness } from "../core/registry.js";
import { assertSafeCatzPath, UnsafeCatzPathError } from "../core/security.js";
import { pathExists } from "../utils/filesystem.js";

export async function addCommand(
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

  const harness = resolveHarness(name);

  if (!harness) {
    console.log(`✗ Unknown harness: ${name}\n`);
    console.log("Available harnesses:");
    for (const available of listAvailableHarnesses()) {
      console.log(`  ${available.name}`);
    }
    return 1;
  }

  if (manifest.harnesses[name]) {
    console.log(`${name} is already installed.`);
    return 0;
  }

  console.log(`Installing ${name}...\n`);

  try {
    await installBuiltinHarness(paths.projectDir, paths.harnessesDir, harness);
  } catch (error) {
    if (error instanceof HarnessInstallConflictError) {
      console.log(`✗ Harness installation path already exists:`);
      console.log(`  .catz/harnesses/${name}/`);
      return 1;
    }
    if (error instanceof UnsafeCatzPathError) {
      return rejectUnsafeWorkspace();
    }

    throw error;
  }

  try {
    await assertSafeCatzPath(paths.projectDir, paths.manifestFile, "file");
    const updatedManifest = registerHarness(manifest, name, harness.version);
    await writeWorkspaceManifest(paths.manifestFile, updatedManifest);
    await assertSafeCatzPath(paths.projectDir, paths.manifestFile, "file");
  } catch (error) {
    if (error instanceof UnsafeCatzPathError) {
      return rejectUnsafeWorkspace();
    }
    throw error;
  }

  console.log(`✓ Resolved ${harness.displayName}`);
  console.log(`✓ Version ${harness.version}`);
  console.log(`✓ Created .catz/harnesses/${name}/`);
  console.log(`✓ Registered ${name}`);
  console.log(`\n${capitalize(name)} harness installed.`);

  return 0;
}

function rejectUnsafeWorkspace(): number {
  console.log("✗ Unsafe CATZ workspace path detected.");
  console.log("CATZ refused to write outside its verified workspace boundary.");
  return 1;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}
