// Node built-in module typings are intentionally not required at runtime.
// @ts-ignore -- resolved by Node.js when the compiled CLI runs.
import { access, mkdir, rm, writeFile } from "node:fs/promises";

interface ErrorWithCode extends Error {
  code?: string;
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDirectory(directoryPath: string): Promise<boolean> {
  if (await pathExists(directoryPath)) {
    return false;
  }

  await mkdir(directoryPath, { recursive: true });
  return true;
}

export async function removeDirectory(directoryPath: string): Promise<boolean> {
  try {
    await rm(directoryPath, { recursive: true, force: false });
    return true;
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }

    throw error;
  }
}

export async function writeJsonFileIfMissing(
  filePath: string,
  value: unknown,
): Promise<boolean> {
  const content = `${JSON.stringify(value, null, 2)}\n`;

  try {
    await writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
    return true;
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      return false;
    }

    throw error;
  }
}

function isAlreadyExistsError(error: unknown): error is ErrorWithCode {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as ErrorWithCode).code === "EEXIST"
  );
}

function isNotFoundError(error: unknown): error is ErrorWithCode {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as ErrorWithCode).code === "ENOENT"
  );
}
