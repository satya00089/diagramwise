import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.resolve(
  scriptDir,
  "../src/data/featuredProblems.json",
);
const problems = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

const failures = [];
const seen = new Map();

if (!Array.isArray(problems)) {
  failures.push("Catalog root must be an array");
} else {
  for (const [index, problem] of problems.entries()) {
    const label = `entry ${index + 1}`;
    for (const field of [
      "title",
      "slug",
      "description",
      "difficulty",
      "category",
      "tags",
    ]) {
      if (
        !problem?.[field] ||
        (Array.isArray(problem[field]) && problem[field].length === 0)
      ) {
        failures.push(`${label} is missing ${field}`);
      }
    }

    if (problem?.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(problem.slug)) {
      failures.push(`${label} has invalid slug: ${problem.slug}`);
    }

    for (const field of ["id", "slug", "title"]) {
      const value = problem?.[field];
      if (!value) continue;
      const key = `${field}:${String(value).trim().toLowerCase()}`;
      const previous = seen.get(key);
      if (previous) {
        failures.push(
          `duplicate ${field} "${value}" at entries ${previous} and ${index + 1}`,
        );
      } else {
        seen.set(key, index + 1);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(
    `Problem catalog validation failed with ${failures.length} issue(s):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Problem catalog valid: ${problems.length} unique entries`);
}
