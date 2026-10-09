import { inspectDoctor } from "../core/doctor.js";

export async function doctorCommand(projectDir?: string): Promise<number> {
  const report = await inspectDoctor({ projectDir });

  console.log("CATZ Doctor\n");

  for (const check of report.checks) {
    const prefix = check.status === "success" ? "✓" : "✗";
    console.log(`${prefix} ${check.message}`);

    for (const detail of check.details ?? []) {
      console.log(detail);
    }
  }

  if (report.stage !== "harnesses") {
    return report.problems > 0 ? 1 : 0;
  }

  if (report.problems > 0) {
    console.log(
      `\n${report.problems} ${report.problems === 1 ? "problem" : "problems"} found.`,
    );
    return 1;
  }

  if (report.harnessCount === 0) {
    console.log("\nNo harnesses installed.");
  }

  console.log("\nEverything looks healthy.");
  return 0;
}
