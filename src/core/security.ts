// Node built-in module typings are intentionally not required at runtime.
// @ts-ignore -- resolved by Node.js when the compiled CLI runs.
import { lstat, realpath } from "node:fs/promises";
// @ts-ignore -- resolved by Node.js when the compiled CLI runs.
import path from "node:path";

interface ErrorWithCode extends Error {
  code?: string;
}

export type ExpectedPathType = "any" | "directory" | "file";

export interface SafePathCheck {
  safe: boolean;
  reason?: string;
}

export class UnsafeCatzPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeCatzPathError";
  }
}

export async function inspectSafeCatzPath(
  projectDir: string,
  targetPath: string,
  expectedType: ExpectedPathType = "any",
): Promise<SafePathCheck> {
  const projectRoot = path.resolve(projectDir);
  const target = path.resolve(targetPath);

  if (!isSameOrDescendant(projectRoot, target)) {
    return { safe: false, reason: "path escapes project root" };
  }

  const projectStats = await lstatOrNull(projectRoot);
  if (!projectStats || !projectStats.isDirectory()) {
    return { safe: false, reason: "project root is not a directory" };
  }
  if (projectStats.isSymbolicLink()) {
    return { safe: false, reason: "project root is a symbolic link or junction" };
  }

  const realProjectRoot = await realpath(projectRoot);
  const relative = path.relative(projectRoot, target);
  const segments = relative === "" ? [] : relative.split(path.sep);
  let current = projectRoot;

  for (const segment of segments) {
    current = path.join(current, segment);
    const stats = await lstatOrNull(current);

    if (!stats) {
      break;
    }

    if (stats.isSymbolicLink()) {
      return {
        safe: false,
        reason: `${path.relative(projectRoot, current) || "."} is a symbolic link or junction`,
      };
    }

    const realCurrent = await realpath(current);
    if (!isSameOrDescendant(realProjectRoot, realCurrent)) {
      return { safe: false, reason: "resolved path escapes project root" };
    }
  }

  const targetStats = await lstatOrNull(target);
  if (!targetStats) {
    return { safe: true };
  }

  if (targetStats.isSymbolicLink()) {
    return { safe: false, reason: "target is a symbolic link or junction" };
  }

  if (expectedType === "directory" && !targetStats.isDirectory()) {
    return { safe: false, reason: "target is not a directory" };
  }

  if (expectedType === "file" && !targetStats.isFile()) {
    return { safe: false, reason: "target is not a regular file" };
  }

  return { safe: true };
}

export async function assertSafeCatzPath(
  projectDir: string,
  targetPath: string,
  expectedType: ExpectedPathType = "any",
): Promise<void> {
  const result = await inspectSafeCatzPath(projectDir, targetPath, expectedType);

  if (!result.safe) {
    throw new UnsafeCatzPathError(result.reason ?? "unsafe CATZ path");
  }
}

function isSameOrDescendant(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function lstatOrNull(targetPath: string) {
  try {
    return await lstat(targetPath);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

function isNotFoundError(error: unknown): error is ErrorWithCode {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as ErrorWithCode).code === "ENOENT"
  );
}
