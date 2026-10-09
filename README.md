# CATZ Harness CLI

CATZ Harness CLI is the command-line entry point for initializing CATZ workspaces and managing installable CATZ harnesses.

## v0.1 milestone plan

The v0.1 command surface is intentionally small:

```text
catz init
catz harness add <name>
catz harness list
catz harness remove <name>
catz harness doctor
```

## Milestone 2 — initialize a CATZ workspace

Build and link the CLI locally:

```bash
npm install
npm run build
npm link
```

Then initialize the current project:

```bash
catz init
```

The command creates:

```text
.catz/
├── harnesses/
└── catz.json
```

with:

```json
{
  "version": 1,
  "harnesses": {}
}
```

Running `catz init` again is safe and does not overwrite an existing `.catz/catz.json`.

Registry resolution, harness installation, listing, removal, and doctor checks are intentionally deferred to later v0.1 milestones.
