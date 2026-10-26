import { describe, expect, it } from 'vitest';
import { Engine } from './engine';
import { makeNode } from './presets';
import type { Topology } from './types';

/* ------------------------------------------------------------------ *
 * What a design past the engine's own ceiling reports.
 *
 * The engine stops holding more than MAX_LIVE_REQUESTS at once, which is
 * it protecting itself rather than anything the design did. The question
 * these pin is what the READER is told while that is happening, and the
 * answer used to be a number that was quietly wrong: arrivals past the
 * ceiling returned before they were counted, so the offered rate read
 * about a quarter of what the client was really sending here, and zero
 * outright once a bounded queue wedged the system. Either way it reads
 * as a client that slowed down rather than a system refusing work.
 * ------------------------------------------------------------------ */

function overloaded(): Topology {
  const client = { ...makeNode('client', 0, 0), id: 'client' };
  client.config.rps = 50_000;
  const service = { ...makeNode('service', 240, 0), id: 'service' };
  /*
   * No queue limit, which is what makes this about the ENGINE's ceiling
   * rather than the design's own. A service with its default queue sheds
   * long before 200,000 requests are ever live, so the arrivals past the
   * ceiling are never reached and the bug this file exists for does not
   * occur. Letting the queue grow is the only way to get there.
   */
  service.config.queueLimit = Number.MAX_SAFE_INTEGER;
  return {
    nodes: [client, service],
    edges: [{ id: 'e', from: 'client', to: 'service', weight: 1 }],
  };
}

function run() {
  const engine = new Engine(overloaded(), 7);
  // A frame, not a coarser step: the rate window is ten 100ms buckets and
  // excludes the one still filling, so stepping a whole bucket per call
  // reads zero whatever the load.
  for (let i = 0; i < 5 * 60; i += 1) engine.advance(1000 / 60);
  return engine.snapshot();
}

describe('a design past the live-request ceiling', () => {
  it('reports the rate the client is actually sending', () => {
    /*
     * Not merely "more than zero". Past the ceiling the uncounted
     * arrivals used to drag this down to roughly a quarter of the real
     * offered rate, which reads as a client that quietly slowed down
     * rather than a system refusing work. The number has to be close to
     * what was asked for.
     */
    expect(run().system.offeredRps).toBeGreaterThan(40_000);
  });

  it('reports the loss rather than a quiet zero', () => {
    expect(run().system.errorRate).toBeGreaterThan(0.5);
  });

  it('shows the bottleneck as busy, not idle', () => {
    expect(run().nodes['service']!.utilization).toBeGreaterThan(0.9);
  });

  it('never reports serving more than was offered', () => {
    const { system } = run();
    expect(system.goodputRps).toBeLessThanOrEqual(system.offeredRps);
  });
});
