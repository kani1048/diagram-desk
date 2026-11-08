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
Implemented as `.environment.json` with a pure validated model and renderer.
The shared catalog, editor, source conflict handling and canvas are reused.

Validation completed:
- Full Node 22 Docker test suite: 27 tests passed.
- Docker production image built successfully.
- Browser: catalog discovery, nested view, node and keyboard link selection,
  mount access/path/reference details, JSON edit/save/reload and restoration.
- Seven-day Preview Desk publication with a synthetic sample only.

Docker/SBX discovery/execution and standard-config import remain out of scope.
The nested SBX example is explicitly a proposal, not an executed environment.
Central CI/review status is checked after marking the PR ready.
