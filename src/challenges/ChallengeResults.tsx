import type {
  ScenarioGoalResult,
  ScenarioResult,
} from "@diagramwise/simulation-core/scenario";
import { scenario } from "./model";
import { formatGoalActual, formatGoalTarget } from "./presentation";

const RESULT_HEADINGS: Record<ScenarioResult["status"], string> = {
  pass: "Repair passed all three runs",
  fail: "Some goals still need work",
  invalid: "Review your repair settings",
  incomplete: "Check incomplete",
};
const GOAL_LABELS: Record<ScenarioGoalResult["metric"], string> = {
  completionFraction: "Successful",
  p95: "p95 latency",
  p99: "p99 latency",
  sampleCount: "Completed samples",
};

export function ChallengeResults({
  result,
  changed,
}: Readonly<{ result: ScenarioResult | null; changed: boolean }>) {
  if (!result) return null;
  if (changed)
    return (
      <div>
        <h3>
          <output>Changed since last check</output>
        </h3>
        <p>Check again to evaluate the current repair.</p>
      </div>
    );
  return (
    <div>
      <h3>
        <output>{RESULT_HEADINGS[result.status]}</output>
      </h3>
      <p>Capacity used: {result.resourceUnits} / 24. Checked on this device.</p>
      {result.issues.map((issue) => (
        <p key={issue}>{issue}</p>
      ))}
      <table>
        <thead>
          <tr>
            <th>Goal</th>
            <th>Observed / required</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {result.goals.map((goal) => (
            <tr key={goal.metric}>
              <th>{GOAL_LABELS[goal.metric]}</th>
              <td>
                {formatGoalActual(goal)} / {formatGoalTarget(goal)}
              </td>
              <td>{goal.met ? "Met" : "Not met"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.status === "pass" && <p>{scenario.lesson}</p>}
    </div>
  );
}
