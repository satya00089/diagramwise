import { describe, expect, it } from 'vitest';
import { runScenario } from './scenario';
import { repairDemoScenario } from './scenarios';

describe('repair scenarios', () => {
  it('fails the supplied bottleneck and accepts two bounded capacity repairs', () => {
    const initial = repairDemoScenario();
    expect(runScenario(initial.initialTopology, initial).status).toBe('fail');

    const widerDatabase = repairDemoScenario();
    widerDatabase.initialTopology.nodes.find(node => node.id === 'database')!.config.capacity = 8;
    expect(runScenario(widerDatabase.initialTopology, widerDatabase).status).toBe('pass');

    const moreDatabaseInstances = repairDemoScenario();
    const database = moreDatabaseInstances.initialTopology.nodes.find(node => node.id === 'database')!;
    database.config.capacity = 2;
    database.config.instances = 4;
    expect(runScenario(moreDatabaseInstances.initialTopology, moreDatabaseInstances).status).toBe('pass');
  }, 30_000);

  it('rejects attempts that remove required work or exceed the resource budget', () => {
    const missingDependency = repairDemoScenario();
    missingDependency.initialTopology.edges = [missingDependency.initialTopology.edges[0]];
    expect(runScenario(missingDependency.initialTopology, missingDependency).status).toBe('invalid');

    const oversized = repairDemoScenario();
    oversized.initialTopology.nodes.find(node => node.id === 'database')!.config.capacity = 100;
    expect(runScenario(oversized.initialTopology, oversized).status).toBe('invalid');
  });
});
