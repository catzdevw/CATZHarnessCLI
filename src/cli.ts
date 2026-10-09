#!/usr/bin/env node

import { addCommand } from "./commands/add.js";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { doctorCommand } from "./commands/doctor.js";
import { removeCommand } from "./commands/remove.js";

declare const process: {
  argv: string[];
  exitCode?: number;
};

const VERSION = "0.1.0";

const HELP = `CATZ Harness CLI v${VERSION}

Usage:
  catz <command>

Commands:
  init
  harness add <name>
  harness list
  harness remove <name>
  harness doctor

Options:
  --help
  --version`;

function printHelp(): void {
  console.log(HELP);
}

function printVersion(): void {
  console.log(`CATZ Harness CLI v${VERSION}`);
}

async function main(args: string[]): Promise<void> {
  if (args.includes("--version") || args.includes("-V")) {
    printVersion();
    return;
  }

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const command = args[0];

  if (command === "init" && args.length === 1) {
    await initCommand();
    return;
  }

  if (command === "harness" && args[1] === "add" && args.length === 3) {
    process.exitCode = await addCommand(args[2]);
    return;
  }

  if (command === "harness" && args[1] === "list" && args.length === 2) {
    process.exitCode = await listCommand();
    return;
  }

  if (command === "harness" && args[1] === "remove" && args.length === 3) {
    process.exitCode = await removeCommand(args[2]);
    return;
  }

  if (command === "harness" && args[1] === "doctor" && args.length === 2) {
    process.exitCode = await doctorCommand();
    return;
  }

  console.error(`Unknown or unavailable command in v0.1 Milestone 6: ${command}`);
  console.error("Run 'catz --help' to see the planned command surface.");
  process.exitCode = 1;
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`CATZ command failed: ${message}`);
  process.exitCode = 1;
});
