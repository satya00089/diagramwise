import { describe, expect, it } from "vitest";
import { normalizeComponentType, transformApiResponse } from "./assessor";

describe("normalizeComponentType", () => {
  it("maps first-party canvas catalog IDs to their assessor semantics", () => {
    expect(normalizeComponentType("web-app")).toBe("frontend");
    expect(normalizeComponentType("mobile-app")).toBe("frontend");
    expect(normalizeComponentType("processing-worker")).toBe("backend");
    expect(normalizeComponentType("recommendation-service")).toBe("backend");
    expect(normalizeComponentType("payment-service")).toBe("backend");
    expect(normalizeComponentType("stream-processor")).toBe("analytics");
    expect(normalizeComponentType("auth-service")).toBe("security");
    expect(normalizeComponentType("loadbalancer")).toBe("load-balancer");
    expect(normalizeComponentType("object-storage")).toBe("storage");
    expect(normalizeComponentType("not-in-the-catalog")).toBe("custom");
  });
});

describe("transformApiResponse", () => {
  it("preserves structured findings and ignores malformed persisted findings", () => {
    const result = transformApiResponse({
      is_valid: true,
      overall_score: 76,
      summary: "A strong baseline with one resilience gap.",
      source: "ai",
      scores: {
        scalability: 80,
        reliability: 70,
        security: 75,
        maintainability: 80,
      },
      feedback: [],
      findings: [
        {
          title: "Single point of failure",
          explanation: "One database serves every request.",
          recommendation: "Explain the failover strategy.",
          severity: "critical",
        },
        { title: "Incomplete legacy finding" },
      ],
      strengths: [],
      improvements: [],
      missing_components: [],
      suggestions: [],
    });

    expect(result.summary).toBe("A strong baseline with one resilience gap.");
    expect(result.source).toBe("ai");
    expect(result.findings).toEqual([
      {
        title: "Single point of failure",
        explanation: "One database serves every request.",
        recommendation: "Explain the failover strategy.",
        severity: "critical",
      },
    ]);
  });

  it("marks rule-based results so the UI can explain the limitation", () => {
    const result = transformApiResponse({
      is_valid: false,
      overall_score: 30,
      source: "rule_based",
      feedback: [],
      strengths: [],
      improvements: [],
      missing_components: [],
      suggestions: [],
    });

    expect(result.source).toBe("rule_based");
    expect(result.findings).toEqual([]);
  });

  it("retains the grounded deduction metadata in a saved review", () => {
    const result = transformApiResponse({ source: "ai", score_available: true,
      overall_score: 87, verdict: "needs_revision", findings: [{
        title: "Permissions bypassed", explanation: "All edits are accepted", severity: "critical",
        kind: "defect", criterion: "security", scored_gap: true,
        evidence_ids: ["auth"], requirement_ids: ["permissions"],
      }] });
    expect(result.findings?.[0]).toMatchObject({ criterion: "security", scored_gap: true,
      evidence_ids: ["auth"], requirement_ids: ["permissions"] });
  });
});
