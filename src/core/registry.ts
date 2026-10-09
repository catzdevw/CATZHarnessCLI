export interface HarnessDefinition {
  name: string;
  displayName: string;
  version: string;
}

const BUILTIN_REGISTRY: Record<string, HarnessDefinition> = {
  presentation: {
    name: "presentation",
    displayName: "CATZ PowerPoint Presentation Harness",
    version: "0.1.0",
  },
};

export function resolveHarness(name: string): HarnessDefinition | undefined {
  return BUILTIN_REGISTRY[name];
}

export function listAvailableHarnesses(): HarnessDefinition[] {
  return Object.values(BUILTIN_REGISTRY);
}
