// @ts-ignore -- resolved by Node.js when the compiled CLI runs.
import { readFile, writeFile } from "node:fs/promises";

export interface HarnessRegistration {
  version: string;
  [key: string]: unknown;
}

export interface WorkspaceManifest {
  version: number;
  harnesses: Record<string, HarnessRegistration>;
  [key: string]: unknown;
}

export class InvalidWorkspaceManifestError extends Error {
  constructor() {
    super("Invalid CATZ workspace manifest");
    this.name = "InvalidWorkspaceManifestError";
  }
}

export async function readWorkspaceManifest(
  manifestPath: string,
): Promise<WorkspaceManifest> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    throw new InvalidWorkspaceManifestError();
  }

  if (!isWorkspaceManifest(parsed)) {
    throw new InvalidWorkspaceManifestError();
  }

  return parsed;
}

export async function writeWorkspaceManifest(
  manifestPath: string,
  manifest: WorkspaceManifest,
): Promise<void> {
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

export function registerHarness(
  manifest: WorkspaceManifest,
  name: string,
  version: string,
): WorkspaceManifest {
  return {
    ...manifest,
    harnesses: {
      ...manifest.harnesses,
      [name]: { version },
    },
  };
}

function isWorkspaceManifest(value: unknown): value is WorkspaceManifest {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.harnesses)) {
    return false;
  }

  return Object.values(value.harnesses).every(
    (entry) => isRecord(entry) && typeof entry.version === "string",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
