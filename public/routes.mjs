import { requireDiagramPath } from '../shared/diagram-formats.mjs';
export function screenUrl(repo = '', diagram = '') {
  if (!repo) return '/workspaces';
  const base = `/workspaces/${encodeURIComponent(repo)}/diagrams`;
  return diagram ? base + '/' + diagram.split('/').map(encodeURIComponent).join('/') : base;
}
export function parseScreen(pathname) {
  if (pathname === '/workspaces' || pathname === '/workspaces/') return { repo: '', diagram: '' };
  const match = pathname.match(/^\/workspaces\/([a-f0-9]+)\/diagrams(?:\/(.+))?\/?$/);
  if (!match) return null;
  try {
    const parts = match[2] ? match[2].split('/').map(decodeURIComponent) : [];
    if (parts.some(part => !part || part === '.' || part === '..' || /[\\/\0]/.test(part))) return null;
    const diagram = parts.join('/');
    if (diagram) requireDiagramPath(diagram);
    return { repo: match[1], diagram };
  } catch { return null; }
}
