#!/usr/bin/env node

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

function main(args: string[]): void {
  if (args.includes("--version") || args.includes("-V")) {
    printVersion();
    return;
  }

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const command = args[0];
  console.error(`Unknown or unavailable command in v0.1 Milestone 1: ${command}`);
  console.error("Run 'catz --help' to see the planned command surface.");
  process.exitCode = 1;
}

main(process.argv.slice(2));
