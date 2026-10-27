import { describe, expect, it } from 'vitest';
import { initialDraft, repair, scenario, validateDraft } from './model';
import { runScenario } from '@diagramwise/simulation-core/scenario';
import { ENGINE_VERSION } from '@diagramwise/simulation-core/runtime';

describe('isolated repair candidates', () => {
  it('keeps the authored baseline immutable and permits persistent capacity repairs', () => {
    const draft = initialDraft();
    const repaired = repair(draft.topology, 'database', 'capacity', 8);
    expect(draft.topology.nodes.find(n => n.id === 'database')?.config.capacity).toBe(2);
    expect(scenario.initialTopology.nodes.find(n => n.id === 'database')?.config.capacity).toBe(2);
    expect(validateDraft({ ...draft, topology: repaired }).topology).toEqual(repaired);
    const result = runScenario(repaired, scenario);
    expect(result.status).toBe('pass');
    expect(result.modelVersion).toBe(ENGINE_VERSION);
    expect(result.seedResults.map(item => item.seed)).toEqual([1, 42, 1337]);
  });
  it('allows over-budget drafts to be inspected but not passed', () => {
    const draft = initialDraft(); draft.topology = repair(draft.topology, 'database', 'capacity', 30);
    expect(() => validateDraft(draft)).not.toThrow();
    expect(runScenario(draft.topology, scenario).status).toBe('invalid');
  });
  it('rejects imported bypasses, changed fixed assumptions and unknown revisions', () => {
    const missing = initialDraft(); missing.topology.edges.pop();
    expect(() => validateDraft(missing)).toThrow();
    const faster = initialDraft(); faster.topology.nodes[2].config.serviceMs = 1;
    expect(() => validateDraft(faster)).toThrow();
    expect(() => validateDraft({ ...initialDraft(), revision: 'unknown' })).toThrow();
    expect(() => repair(initialDraft().topology, 'client', 'capacity', 20)).toThrow();
    expect(() => repair(initialDraft().topology, 'database', 'capacity', 1.5)).toThrow();
  });
});
