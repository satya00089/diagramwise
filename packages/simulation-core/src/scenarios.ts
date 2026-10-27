import { defaultConfig } from './presets';
import type { ScenarioDefinition } from './scenario';
import { ENGINE_VERSION, PROFILE_VERSION } from './runtime';

/** Authored model assumptions. Values are educational concurrency/service-time units. */
export const databaseBottleneckScenario: ScenarioDefinition = {
  id: 'repair-database-bottleneck',
  revision: '2',
  name: 'Clear the database queue',
  brief: 'This API receives 150 requests a second. Every request must complete a database read. Keep at least 99% successful, p95 under 200 ms and p99 under 350 ms, within 24 concurrency units. Find the bottleneck and repair its capacity.',
  modelVersion: ENGINE_VERSION,
  profileVersion: PROFILE_VERSION,
  initialTopology: {
    nodes: [
      { id: 'client', kind: 'client', label: 'Clients', x: 80, y: 180, config: { ...defaultConfig('client'), rps: 150, timeoutMs: 2_000, retries: 0 } },
      { id: 'api', kind: 'service', label: 'Read API', x: 380, y: 180, config: { ...defaultConfig('service'), capacity: 16, instances: 1, serviceMs: 5, serviceCv: 0, queueLimit: 64, timeoutMs: 1_000, retries: 0, errorRate: 0 } },
      { id: 'database', kind: 'db', label: 'Database', x: 680, y: 180, config: { ...defaultConfig('db'), capacity: 2, instances: 1, serviceMs: 40, serviceCv: 0, queueLimit: 64, timeoutMs: 0, retries: 0, errorRate: 0 } },
    ],
    edges: [
      { id: 'client-api', from: 'client', to: 'api', weight: 1 },
      { id: 'api-database', from: 'api', to: 'database', weight: 1 },
    ],
  },
  workload: { rps: 150, pattern: 'steady' },
  seeds: [1, 42, 1337],
  warmupMs: 10_000,
  measurementMs: 60_000,
  completionDeadlineMs: 5_000,
  constraints: {
    allowTopologyChanges: false,
    allowedConfigFields: { api: ['capacity', 'instances', 'queueLimit'], database: ['capacity', 'instances', 'queueLimit'] },
    requiredNodeIds: ['client', 'api', 'database'],
    requiredEdgeIds: ['client-api', 'api-database'],
    requiredCompletedNodeIds: ['api', 'database'],
    resourceBudget: 24,
  },
  goals: { minCompletionFraction: 0.99, maxP95Ms: 200, maxP99Ms: 350, minSuccessfulSamples: 1_000 },
  hints: [
    'Raise the traffic and watch which component accumulates waiting work.',
    'Each database read takes 40 ms. How many reads can two concurrent slots finish per second?',
    'More work can run on one instance, or across several instances. Both consume the same concurrency budget in this model.',
  ],
  lesson: 'The database queue grew because requests arrived faster than its available slots could finish them. Increasing queue length only stores more waiting work. Adding concurrency lets more reads complete at the same time without pretending that an individual read became faster. Here, widening one instance or adding instances are both valid within the stated model and budget; actual database scaling also depends on storage, consistency and workload behavior.',
};

/** Callers can edit the returned graph without changing the published scenario. */
export function repairDemoScenario(): ScenarioDefinition {
  return structuredClone(databaseBottleneckScenario);
}
