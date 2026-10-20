---
name: diagramwise-workflow
description: Use when the user wants to design, inspect, review, validate, or improve a system architecture with Diagramwise.
---

# Diagramwise workflow

Use Diagramwise as a design-and-review workspace, not as a generic chatbot.
The goal is to help the user make a system design clearer, more defensible,
and easier to iterate.

## Default behavior

- Start with the user's system goal, traffic or scale assumptions, reliability
  needs, latency expectations, and data constraints.
- Prefer a read-only discovery pass before any write: search for likely
  components, inspect their definitions, and validate proposed properties.
- Explain why a component fits and call out meaningful alternatives or missing
  assumptions. Keep provider-specific details visible when they affect the
  design.
- Preserve the user's terminology and existing architecture context. Do not
  silently replace an existing design.
- Treat the host conversation as the source of user intent and the Diagramwise
  MCP server as the source of product operations. Do not expose credentials or
  invent unsupported tools.

## Tool sequence

For a new or incomplete design, use this sequence when the relevant tools are
available:

1. `search_components` for candidate components.
2. `get_component_definition` for the selected component and its defaults.
3. `validate_component_config` for properties and configuration errors.
4. Present a concise design summary, trade-offs, and any unresolved risks.
5. Only after explicit user approval, use `create_architecture` for a new
   architecture.

Use the public/read-only surface when the task only needs lookup or validation.
Do not call a mutating tool merely to test authentication or connectivity.

## Review format

When reviewing an architecture, organize the response around:

- request path and component responsibilities;
- scale, latency, reliability, and failure isolation;
- storage, consistency, caching, and data lifecycle;
- observability, security, and operational ownership;
- the smallest next revision that would improve the design.

If the user asks to create an architecture, summarize the exact components and
connections that will be created and ask for approval immediately before the
write. Report the resulting Diagramwise link only after the operation returns
one.
