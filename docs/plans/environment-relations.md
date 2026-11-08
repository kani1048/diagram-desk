# Role environment relationship viewer

## Purpose
Visualize role, agent configuration, SBX boundaries, containers, Docker daemons,
mounts, and external services using Diagram Desk's existing catalog and canvas.

## Scope
- Add an environment relationship JSON format with validated hierarchy and links.
- Render containment, typed connections, source references and verification status.
- Selecting nodes/links reveals details and related elements.
- Include the proposed role-designer environment as explicitly unverified sample.
- Reuse source editing, conflict handling, pan/zoom and repository discovery.
- No Docker/SBX execution, credentials, auto-discovery or configuration management.

## Validation plan
Unit tests for model validation, layout, selection, escaping and format integration;
existing full test suite; Docker build and browser review via a seven-day VPN preview.

## Status
Planning complete. Implementation has not started.
