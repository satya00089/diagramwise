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

  it('explains a reachable work queue without a pull consumer and its idle destinations', () => {
    const result = compileGraph({
      nodes: [
        { id: 'client', data: { simulation: { kind: 'client' }, label: 'Browser' } },
        { id: 'events', data: { simulation: { kind: 'queue' }, label: 'Operation Event Bus' } },
        { id: 'database', data: { simulation: { kind: 'db' }, label: 'Document Database' } },
        { id: 'search', data: { simulation: { kind: 'searchindex' }, label: 'Search Index' } },
        { id: 'optional', data: { simulation: { kind: 'cache' }, label: 'Optional cache' } },
      ],
      edges: [
        { id: 'publish', source: 'client', target: 'events' },
        { id: 'database-write', source: 'events', target: 'database' },
        { id: 'index-write', source: 'events', target: 'search' },
      ],
    });
    expect(result.topology).not.toBeNull();
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'queue-without-consumer', nodeId: 'events', severity: 'warning' }),
      expect.objectContaining({ code: 'unreachable-component', nodeId: 'database', severity: 'warning', message: expect.stringContaining('No delivery from Operation Event Bus') }),
      expect.objectContaining({ code: 'unreachable-component', nodeId: 'search', severity: 'warning', message: expect.stringContaining('No delivery from Operation Event Bus') }),
      expect.objectContaining({ code: 'unreachable-component', nodeId: 'optional', severity: 'info' }),
    ]));
  });

  it.each([
    ['queue to worker', { id: 'consume', source: 'events', target: 'worker' }],
    ['worker to queue', { id: 'consume', source: 'worker', target: 'events' }],
  ])('treats a %s link as a pull relationship, not a pushed request route', (_name, consumerEdge) => {
    const result = compileGraph({
      nodes: [
        { id: 'client', data: { simulation: { kind: 'client' } } },
        { id: 'events', data: { simulation: { kind: 'queue' } } },
        { id: 'worker', data: { simulation: { kind: 'worker' } } },
        { id: 'database', data: { simulation: { kind: 'db' } } },
      ],
      edges: [
        { id: 'publish', source: 'client', target: 'events' },
        consumerEdge,
        { id: 'persist', source: 'worker', target: 'database' },
      ],
    });
    expect(result.topology).not.toBeNull();
    expect(result.diagnostics.some(item => item.code === 'queue-without-consumer')).toBe(false);
    expect(result.diagnostics.some(item => item.code === 'unreachable-component' && item.nodeId === 'database')).toBe(false);
    expect(result.diagnostics.some(item => item.code === 'request-cycle')).toBe(false);
  });

  it('does not treat control edges as traffic reachability or mistake cache hits for a broken path', () => {
    const result = compileGraph({
      nodes: [
        { id: 'client', data: { simulation: { kind: 'client' } } },
        { id: 'cache', data: { simulation: { kind: 'cache', config: { hitRate: 1 } } } },
        { id: 'database', data: { simulation: { kind: 'db' } } },
        { id: 'autoscaler', data: { simulation: { kind: 'autoscaler' } } },
        { id: 'unreachable', data: { simulation: { kind: 'service' } } },
      ],
      edges: [
        { id: 'client-cache', source: 'client', target: 'cache' },
        { id: 'cache-db', source: 'cache', target: 'database' },
        { id: 'scale-db', source: 'autoscaler', target: 'unreachable', data: { simulation: { mode: 'control' } } },
      ],
    });
    expect(result.diagnostics.some(item => item.code === 'unreachable-component' && item.nodeId === 'database')).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'unreachable-component', nodeId: 'unreachable', severity: 'info' }));
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
