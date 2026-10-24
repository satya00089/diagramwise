import { describe, expect, it } from 'vitest';
import { compileGraph } from './compiler';

describe('compileGraph', () => {
  it('explains why a scheduled-job-only design cannot use request-rate controls', () => {
    const result = compileGraph({
      nodes: [
        { id: 'schedule', data: { simulation: { kind: 'cron' } } },
        { id: 'worker', data: { simulation: { kind: 'worker' } } },
      ],
      edges: [{ id: 'scheduled-work', source: 'schedule', target: 'worker' }],
    });
    expect(result.topology).toBeNull();
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'scheduled-source-needs-client', severity: 'error',
    }));
  });

  it('adds a visible virtual source for one unambiguous ingress', () => {
    const result = compileGraph({
      nodes: [
        { id: 'api', data: { componentId: 'microservice', label: 'API' }, position: { x: 100, y: 40 } },
        { id: 'database', data: { componentId: 'database', label: 'Database' }, position: { x: 350, y: 40 } },
      ],
      edges: [{ id: 'api-db', source: 'api', target: 'database' }],
    });
    expect(result.topology?.nodes.map(node => node.id)).toContain('__simulation_source__');
    expect(result.virtualSourceId).toBe('__simulation_source__');
    expect(result.diagnostics.some(item => item.severity === 'error')).toBe(false);
  });

  it('requires a chosen model for an unknown component on a request path', () => {
    const result = compileGraph({
      nodes: [
        { id: 'client', data: { componentId: 'client', label: 'Client' } },
        { id: 'unknown', data: { componentId: 'future-vendor-service', label: 'Unknown' } },
      ],
      edges: [{ id: 'client-unknown', source: 'client', target: 'unknown' }],
    });
    expect(result.topology).toBeNull();
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unmodeled-component', nodeId: 'unknown', severity: 'error' }),
    ]));
  });

  it('keeps cosmetic edits out of its semantic fingerprint', () => {
    const base = { nodes: [
      { id: 'client', data: { componentId: 'client', label: 'Client', backgroundColor: '#000' }, position: { x: 0, y: 0 } },
      { id: 'api', data: { componentId: 'microservice', label: 'API' }, position: { x: 200, y: 0 } },
    ], edges: [{ id: 'client-api', source: 'client', target: 'api', data: { color: '#fff' } }] };
    const moved = structuredClone(base);
    moved.nodes[0].data.label = 'Renamed client';
    moved.nodes[0].position = { x: 900, y: 800 };
    moved.nodes[1].data.backgroundColor = '#f0f';
    expect(compileGraph(base).fingerprint).toBe(compileGraph(moved).fingerprint);
  });
});
