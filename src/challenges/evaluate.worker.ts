import { runScenario, evaluateScenario } from '@diagramwise/simulation-core/scenario';
import type { ScenarioResult } from '@diagramwise/simulation-core/scenario';
import type { Topology } from '@diagramwise/simulation-core';
import { scenario } from './model';

self.onmessage = (event: MessageEvent<{ id: string; topology: Topology }>) => {
  const { id, topology } = event.data;
  try {
    // Keep the synchronous evaluator authoritative; progress is emitted between seeds.
    const parts: ScenarioResult[] = [];
    for (const [index, seed] of scenario.seeds.entries()) {
      self.postMessage({ id, progress: `Checking run ${index + 1} of ${scenario.seeds.length}` });
      const result = runScenario(topology, { ...scenario, seeds: [seed] });
      parts.push(result);
      if (result.status === 'invalid' || result.status === 'incomplete') break;
    }
    const first = parts[0];
    const result: ScenarioResult = {
      ...first,
      seedResults: parts.flatMap(part => part.seedResults),
      issues: [...new Set(parts.flatMap(part => part.issues))],
      goals: [],
      status: parts.some(part => part.status === 'invalid') ? 'invalid'
        : parts.length !== scenario.seeds.length || parts.some(part => part.status === 'incomplete') ? 'incomplete'
        : parts.every(part => part.status === 'pass') ? 'pass' : 'fail',
    };
    self.postMessage({ id, result: evaluateScenario(result, scenario) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'The check could not finish.' });
  }
};
