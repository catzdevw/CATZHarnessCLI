// Node built-in module typings are intentionally not required at runtime.
// @ts-ignore -- resolved by Node.js when the compiled CLI runs.
import path from "node:path";

declare const process: {
  cwd(): string;
};

export interface CatzPaths {
  projectDir: string;
  catzDir: string;
  harnessesDir: string;
  manifestFile: string;
}

export function getCatzPaths(projectDir: string = process.cwd()): CatzPaths {
  const catzDir = path.join(projectDir, ".catz");

  return {
    projectDir,
    catzDir,
    harnessesDir: path.join(catzDir, "harnesses"),
    manifestFile: path.join(catzDir, "catz.json"),
  };
}
