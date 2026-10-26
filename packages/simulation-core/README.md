# Diagramwise simulation core

This package is the deterministic, browser-safe simulation engine shared by the
Diagramwise canvas, replay tooling, and repair challenges. It has no React,
network, persistence, or editor dependency.

The initial event kernel and behaviour modules were adapted from Breakscale at
commit `c58de512f3ae06f40f1f9037f844b5fe1de1c79f`, which is MIT licensed. The
upstream license is retained in `LICENSE.breakscale`. Diagramwise adaptations
include worker-friendly progress reporting, deterministic controller ticks,
bounded latency histograms, explicit resource-limit outcomes, graph compilation,
catalog profiles, and scenario evaluation.

Simulation readings model the supplied assumptions. They are not provider
benchmarks or measurements of a deployed system.
