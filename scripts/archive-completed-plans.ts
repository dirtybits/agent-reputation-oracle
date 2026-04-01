// @ts-nocheck
import fs from "fs";
import path from "path";

type PlanStatus = "completed" | "incomplete" | "no_todos" | "unparseable";

interface PlanRecord {
  fileName: string;
  sourcePath: string;
  destinationPath: string;
  status: PlanStatus;
  todoCount: number;
}

function extractFrontmatter(text: string): string | null {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  return match ? match[1] : null;
}

function getTodoStatuses(frontmatter: string): string[] {
  const todoBlocks = frontmatter.match(
    /(^|\n)  - id: [\s\S]*?(?=(\n  - id: )|$)/g
  );

  if (!todoBlocks) return [];

  return todoBlocks.map((block) => {
    const statusMatch = block.match(/\n    status:\s*(.+)/);
    return statusMatch ? statusMatch[1].trim().toLowerCase() : "";
  });
}

function getPlanStatus(
  filePath: string
): Pick<PlanRecord, "status" | "todoCount"> {
  const text = fs.readFileSync(filePath, "utf8");
  const frontmatter = extractFrontmatter(text);

  if (!frontmatter) {
    return { status: "unparseable", todoCount: 0 };
  }

  const statuses = getTodoStatuses(frontmatter);

  if (statuses.length === 0) {
    return { status: "no_todos", todoCount: 0 };
  }

  const allCompleted = statuses.every((status) => status === "completed");

  return {
    status: allCompleted ? "completed" : "incomplete",
    todoCount: statuses.length,
  };
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const repoRoot = path.resolve(__dirname, "..");
  const plansDir = path.join(repoRoot, ".cursor", "plans");
  const archiveDir = path.join(plansDir, "archive");

  const files = fs
    .readdirSync(plansDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".plan.md"))
    .map((entry) => entry.name)
    .sort();

  const plans: PlanRecord[] = files.map((fileName) => {
    const sourcePath = path.join(plansDir, fileName);
    const destinationPath = path.join(archiveDir, fileName);
    const { status, todoCount } = getPlanStatus(sourcePath);

    return {
      fileName,
      sourcePath,
      destinationPath,
      status,
      todoCount,
    };
  });

  const completedPlans = plans.filter((plan) => plan.status === "completed");

  if (completedPlans.length === 0) {
    console.log("No completed plans to archive.");
    return;
  }

  fs.mkdirSync(archiveDir, { recursive: true });

  let movedCount = 0;
  let skippedCount = 0;

  for (const plan of completedPlans) {
    if (fs.existsSync(plan.destinationPath)) {
      skippedCount += 1;
      console.log(`skip ${plan.fileName} (already exists in archive)`);
      continue;
    }

    if (dryRun) {
      console.log(
        `dry-run ${plan.fileName} -> .cursor/plans/archive/${plan.fileName}`
      );
      movedCount += 1;
      continue;
    }

    fs.renameSync(plan.sourcePath, plan.destinationPath);
    movedCount += 1;
    console.log(
      `moved ${plan.fileName} -> .cursor/plans/archive/${plan.fileName}`
    );
  }

  if (dryRun) {
    console.log(
      `Dry run complete. ${movedCount} plan(s) would be archived, ${skippedCount} skipped.`
    );
    return;
  }

  console.log(
    `Archive complete. ${movedCount} plan(s) moved, ${skippedCount} skipped.`
  );
}

main();
