import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const guideDirectory = path.join(
  projectDirectory,
  "src",
  "data",
  "public",
  "problemGuides",
);
const catalogPath = path.join(
  projectDirectory,
  "src",
  "data",
  "featuredProblems.json",
);

const guardedGuides = {
  "url-shortener-like-bit-ly": {
    required: ["shortCode", "originalUrl", "Base62", "redirect", "cache"],
    forbidden: [
      "ConnectionSession",
      "FanoutCursor",
      "room or object membership",
      "reconnect storms",
    ],
  },
  "distributed-cache": {
    required: [
      "CacheEntry",
      "Partition",
      "Replica",
      "TTL",
      "eviction",
      "consistent hashing",
    ],
    forbidden: [
      "ResourceSpec",
      "ReconciliationCheckpoint",
      "desired-state command",
      "reconcile providers",
    ],
  },
  "notification-system": {
    required: [
      "NotificationRequest",
      "UserPreference",
      "Template",
      "DeliveryAttempt",
      "provider",
      "retry",
    ],
    forbidden: [
      "ConnectionSession",
      "FanoutCursor",
      "room or object membership",
      "reconnect storms",
    ],
  },
  "design-a-hotel-booking-system": {
    required: [
      "ReservationIntent",
      "InventoryClaim",
      "PaymentAttempt",
      "availability",
      "overbooking",
    ],
    forbidden: ["packing", "campaign dispatch", "room or object membership"],
  },
  "design-an-api-rate-limiter": {
    required: [
      "RateLimitPolicy",
      "CounterBucket",
      "token bucket",
      "atomic",
      "fail closed",
    ],
    forbidden: [
      "ResourceSpec",
      "ReconciliationCheckpoint",
      "desired-state command",
      "reconcile providers",
    ],
  },
  "design-a-conversational-ai-platform-with-rag": {
    required: [
      "DocumentVersion",
      "Chunk",
      "ConversationTurn",
      "citation",
      "retrieval",
    ],
    forbidden: ["FeatureSnapshot", "TrainingRun", "reconcile providers"],
  },
};

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const catalogSlugs = new Set(catalog.map((problem) => problem.slug));
const issues = [];

for (const [slug, guard] of Object.entries(guardedGuides)) {
  const guidePath = path.join(guideDirectory, `${slug}.json`);

  if (!catalogSlugs.has(slug)) {
    issues.push(`${slug}: missing from featuredProblems.json`);
  }

  if (!fs.existsSync(guidePath)) {
    issues.push(`${slug}: guide file is missing`);
    continue;
  }

  let guide;
  try {
    guide = JSON.parse(fs.readFileSync(guidePath, "utf8"));
  } catch (error) {
    issues.push(`${slug}: invalid JSON (${error.message})`);
    continue;
  }

  const serializedGuide = JSON.stringify(guide);
  const normalizedGuide = serializedGuide.toLowerCase();

  for (const term of guard.required) {
    if (!normalizedGuide.includes(term.toLowerCase())) {
      issues.push(`${slug}: missing domain anchor "${term}"`);
    }
  }

  for (const term of guard.forbidden) {
    if (normalizedGuide.includes(term.toLowerCase())) {
      issues.push(`${slug}: suspicious template term "${term}"`);
    }
  }
}

const guideFiles = fs
  .readdirSync(guideDirectory)
  .filter((fileName) => fileName.endsWith(".json"));
for (const fileName of guideFiles) {
  const guideText = fs.readFileSync(
    path.join(guideDirectory, fileName),
    "utf8",
  );
  if (/\$\{(?:lower|noun)\}/i.test(guideText)) {
    issues.push(`${fileName}: unresolved generated placeholder`);
  }
}

if (issues.length > 0) {
  console.error(
    `Problem guide validation failed with ${issues.length} issue(s):`,
  );
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(
    `Problem guide validation passed for ${Object.keys(guardedGuides).length} guarded canonical guides and ${guideFiles.length} guide files.`,
  );
}
