import { getApiBaseUrl } from "./api";
import type { SystemDesignProblem, SystemDesignSolution } from "../types/systemDesign";
import type { SimulationPreparation } from "../types/simulation";

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
  if (!problem || problem.slug !== "url-shortener-like-bit-ly") {
    throw new Error("Choose the URL-shortener exercise before preparing a simulation.");
  }

  const payload = {
    contractVersion: "1",
    scenarioId: "url-shortener-capacity",
    problem: {
      id: problem.id,
      slug: problem.slug,
      requirementRevision: problem.requirementSpec?.revision ?? null,
    },
    components: solution.components.map(({ id, type, label, properties }) => ({
      id, type, label, properties,
    })),
    connections: solution.connections.map(
      ({ id, source, target, type, label, description, properties }) => ({
        id, source, target, type, label, description, properties,
      }),
    ),
  };

  const response = await fetch(
    `${SIMULATION_API_BASE_URL.replace(/\/$/, "")}/api/v1/simulation/prepare`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
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

  if (
    result.contract_version !== "1" ||
    result.scenario_id !== "url-shortener-capacity" ||
    result.exercise_id !== problem.id ||
    result.requirement_revision !== (problem.requirementSpec?.revision ?? null)
  ) {
    throw new Error("The preparation does not match this exercise. Reload and prepare again.");
  }
  return result;
}
