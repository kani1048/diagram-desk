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

## Follow-up: parallel roles with DinD
Treat HR as a peer of implementation and review. Add a proposed shared-SBX
runtime with parallel role containers, each owning a dedicated Docker daemon
and user configuration. Keep the prior nested-SBX example for comparison.
Validate both samples with the existing model/layout tests, build and preview.
This changes diagrams only; no daemon or container privileges are provisioned.

Follow-up completed: HR, implementation and review are peers under runtime,
with per-role user configuration and DinD. Both examples validate; all 27 tests
pass under Node 22, the Docker image builds, and browser selection is verified.

## Follow-up: simplify role workspaces
Remove dedicated DinD daemons from individual role containers. Keep the runtime
Docker daemon that creates parallel role workspaces. Do not implicitly give roles
access to that daemon; how roles request Docker operations remains undecided.
Validate the revised sample and refresh the preview. No runtime provisioning.

Simplification completed: only the runtime daemon remains in the current
sample (14 nodes, 8 links). Model/layout validation passed. No application
logic changed; prior 27-test result remains the baseline for the renderer.

## Follow-up: current assistant involvement
Add the user and this conversation's Codex as participants outside the proposed
runtime. Show actual diagram/code/PR work separately from proposed HR/bootstrap
and runtime work. No claim of existing role orchestration or deployment inside
SBX. Validate the sample and refresh the preview; no provisioning changes.

Assistant involvement completed: participants are outside the planned runtime;
confirmed editing/testing/PR relationships carry evidence, while bootstrap work
remains proposed. Updated sample validates (18 nodes / 13 links); 27 tests pass.

## Follow-up: orchestration and portable role definitions
Update the sample and explanatory docs only: this conversation's Codex is the
proposed overall orchestrator, assigning work, evaluating role outcomes and
requesting measured tuning from HR. Runtime owns execution; Customizer supplies
standard CODEX_HOME only. Mounted repositories and GitHub issues/PRs preserve
pushed work. Uncommitted/unpushed work is deliberately not migrated; non-Git
persistent data management is outside this architecture. Authentication is
reconfigured using a checklist/guide. No live orchestration is implemented.
Validate the sample with existing tests, build the preview and inspect it.

Orchestration update completed: the sample documents assignment, evidence-based
role evaluation, HR tuning proposals and version comparison/adoption. It adds
CODEX_HOME-only exchange, independent project workspaces and issue/PR records.
Migration exclusions and fresh-auth setup are explicit. Node 22 suite: 27 passed.
No role execution, evaluation service or backup system was introduced.

## Follow-up: three-context triangle layout
For three Onion contexts, use triangle vertices rather than a center hub and two
opposite satellites. Preserve one/two-context row and four-plus hub behavior.
Check unequal radii clearance, non-collinearity, determinism and full rendering.
Also align the environment example with Codex owning role definition/revision.

Completed: three-context layouts use triangle vertices with pairwise radius
clearance; one/two rows and four-plus hub behavior are covered by regression
checks. All 28 Node 22 tests pass. The current sample now shows per-role SBX and
Codex-owned role revisions; agent-runtime ports are documented as Presentation-owned.

## Follow-up: explain adapters and external resources
Add optional described external resources to Onion diagrams, with validated
references and placement outside context rings. Show component descriptions in
selection details so client/driver responsibilities are inspectable. Preserve
existing models. Validate model references, escaping, ring clearance and render.

Completed: optional external resources validate references/types and sit outside
all context rings. Nodes expose descriptions in selection details. Nodes render
above cross-context lines so a line cannot steal endpoint selection. All 29
Node 22 tests pass; browser client/resource selection and descriptions verified.
