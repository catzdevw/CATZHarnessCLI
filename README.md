# CATZ Harness CLI

A lightweight command-line interface for initializing CATZ workspaces and managing CATZ harnesses.

> **v0.1 note:** the `presentation` harness is currently a built-in installation fixture used to validate the CLI contract. The full CATZ PowerPoint Presentation Harness is not bundled yet. It will replace this fixture in a later repository integration step.

## Requirements

- Node.js 20 or newer
- npm / npx

## Quick Start

Run CATZ without installing it globally:

```bash
npx catz-harness init
npx catz-harness harness add presentation
npx catz-harness harness list
npx catz-harness harness doctor
```

A CATZ workspace lives inside the current project:

```text
.catz/
├── catz.json
└── harnesses/
```

## Commands

### Initialize a workspace

```bash
catz init
```

Creates `.catz/`, `.catz/harnesses/`, and `.catz/catz.json`. Running it again is safe and does not overwrite an existing manifest.

### Add a harness

```bash
catz harness add <name>
```

For v0.1, the built-in installable fixture is:

```bash
catz harness add presentation
```

The command creates the managed harness directory and registers the harness version in `.catz/catz.json`.

### List installed harnesses

```bash
catz harness list
```

Lists harnesses registered in `.catz/catz.json`. The workspace manifest is the source of truth for installed state.

### Remove a harness

```bash
catz harness remove <name>
```

Recursively removes the CATZ-managed harness directory and unregisters it from the workspace manifest. Removal is idempotent and validates harness names before touching the filesystem.

### Diagnose a workspace

```bash
catz harness doctor
```

Performs read-only health checks for:

- supported Node.js runtime
- CATZ workspace presence
- valid `.catz/catz.json`
- harness root presence
- each registered harness directory
- each registered `harness.json`
- harness name consistency
- harness version consistency

Doctor does not repair or rewrite workspace state.

## Local Development

```bash
npm install
npm test
npm link
```

Then the local executable is available as:

```bash
catz --version
catz --help
```

## Package Verification

Before publishing a release:

```bash
npm test
npm pack --dry-run
npm pack
```

The npm package intentionally ships compiled `dist/` output plus npm's automatically included package metadata, README, and license. Source files and tests are not part of the published package.

## Version

Current release target: `0.1.0`.

## License

MIT
