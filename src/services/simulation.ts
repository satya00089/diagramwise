import { getApiBaseUrl } from "./api";
import type { SystemDesignProblem, SystemDesignSolution } from "../types/systemDesign";
import type { SimulationPreparation } from "../types/simulation";
import { buildAssessmentPayload } from "../utils/assessor";

const SIMULATION_API_BASE_URL = getApiBaseUrl(
  import.meta.env.VITE_API_URL,
  import.meta.env.VITE_ASSESSMENT_API_URL,
);

export async function prepareSimulation(
  solution: SystemDesignSolution,
  problem: SystemDesignProblem | null,
  signal?: AbortSignal,
): Promise<SimulationPreparation> {
  if (!SIMULATION_API_BASE_URL) {
    throw new Error(
      "The assessment API URL is not configured. Set VITE_API_URL to prepare this simulation.",
    );
  }

  const response = await fetch(
    `${SIMULATION_API_BASE_URL.replace(/\/$/, "")}/api/v1/simulation/prepare`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(buildAssessmentPayload(solution, problem)),
      signal,
    },
  );

  const result = (await response.json().catch(() => null)) as
    | (SimulationPreparation & { detail?: string | { message?: string } })
    | null;
  if (!response.ok || !result) {
    const detail = result?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message ??
          "AI could not prepare this diagram. No simulation metrics were produced.";
    throw new Error(message);
  }

  return result;
}
