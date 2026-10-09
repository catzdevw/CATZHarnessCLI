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

Milestone 1 establishes the executable itself:

```bash
npm install
npm run build
npm link
catz --version
catz --help
```

Expected version:

```text
CATZ Harness CLI v0.1.0
```

Harness installation behavior is implemented in later v0.1 milestones.
