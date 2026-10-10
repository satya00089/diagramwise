/** Versioned exercise scope, separate from reference architecture choices. */
export interface Requirement {
  id: string;
  text: string;
  scope: "core" | "extension";
  category?: string;
}

export interface RequirementSpec {
  schemaVersion: 1;
  revision: string;
  functional: Requirement[];
  nonFunctional: Requirement[];
  assumptions: string[];
}

export interface RequirementCoverage {
  requirement_id: string;
  status: "supported" | "partial" | "missing" | "needs_clarification";
  explanation: string;
  evidence_ids: string[];
}
