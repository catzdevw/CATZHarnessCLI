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

export const SAFE_HARNESS_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const SAFE_VERSION = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/;

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
  if (!isWorkspaceManifest(manifest)) {
    throw new InvalidWorkspaceManifestError();
  }

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
  if (!SAFE_HARNESS_NAME.test(name) || !SAFE_VERSION.test(version)) {
    throw new InvalidWorkspaceManifestError();
  }

  return {
    ...manifest,
    harnesses: {
      ...manifest.harnesses,
      [name]: { version },
    },
  };
}

export function unregisterHarness(
  manifest: WorkspaceManifest,
  name: string,
): WorkspaceManifest {
  const harnesses = { ...manifest.harnesses };
  delete harnesses[name];

  return {
    ...manifest,
    harnesses,
  };
}

function isWorkspaceManifest(value: unknown): value is WorkspaceManifest {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.harnesses)) {
    return false;
  }

  return Object.entries(value.harnesses).every(
    ([name, entry]) =>
      SAFE_HARNESS_NAME.test(name) &&
      isRecord(entry) &&
      typeof entry.version === "string" &&
      SAFE_VERSION.test(entry.version),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
