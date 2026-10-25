import { Viewer } from '/viewer.mjs';
import { screenUrl as link, parseScreen } from '/routes.mjs';
import { rendererFor } from '/renderers/index.mjs';
import { DiagramPreviews } from '/diagram-previews.mjs';
import { diagramMetadata } from '/shared/diagram-formats.mjs';
const $ = id => document.getElementById(id);
let repositories = [], diagrams = [], activeRepo = '', revision = 0, thumbnails = 0, selected = '';
const cache = new Map();
const previews = new DiagramPreviews(rendererFor);
const viewer = new Viewer({
  rendererFor,
  api,
  onSaved(repo, path, source) {
    const item = cache.get(repo)?.find(item => item.path === path);
    if (!item) return;
    Object.assign(item, diagramMetadata(path, source), { source });
    if (repo === activeRepo && path === selected) {
      $('kind').textContent = item.kind || rendererFor(path).label;
    }
  },
});
function navigate(repo = '', diagram = '') { if (!viewer.canLeave()) return; history.pushState(null, '', link(repo, diagram)); render(); }
function failure(error) { $('error').hidden = false; $('error').textContent = error.message; }
async function api(path) { const response = await fetch(path); const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; }
function breadcrumb(label, href) { const item = document.createElement(href ? 'a' : 'span'); item.textContent = label; if (href) item.href = href; $('breadcrumbs').append(item); }
function separator() { breadcrumb(' / '); }
function heading(eyebrow, title, description) { $('eyebrow').textContent = eyebrow; $('title').textContent = title; $('description').textContent = description; document.title = title + ' · Diagram Desk'; }
function workspaceCards() {
  $('workspace-list').replaceChildren(); $('workspace-empty').hidden = repositories.length > 0;
  for (const repo of repositories) {
    const card = document.createElement('button'); card.className = 'card';
    const icon = document.createElement('span'); icon.className = 'workspace-icon'; icon.textContent = '◈';
    const name = document.createElement('strong'); name.textContent = repo.name;
    const path = document.createElement('small'); path.textContent = repo.path;
    const footer = document.createElement('div'); footer.className = 'workspace-footer'; footer.textContent = '図を一覧する →';
    card.append(icon, name, path, footer); card.onclick = () => { $('search').value = ''; navigate(repo.id); }; $('workspace-list').append(card);
  }
}
async function catalog() {
  const generation = ++thumbnails;
  const visible = diagrams.filter(item => item.path.toLowerCase().includes($('search').value.toLowerCase()));
  $('diagram-list').replaceChildren(); $('count').textContent = visible.length + ' 件の図'; $('diagram-empty').hidden = visible.length > 0;
  const cards = [];
  for (const [index, item] of visible.entries()) {
    const card = document.createElement('button'); card.className = 'card';
    const thumb = document.createElement('div'); thumb.className = 'thumb'; thumb.textContent = 'プレビューを読み込み中…';
    const name = document.createElement('strong'); name.textContent = item.name;
    const path = document.createElement('small'); path.textContent = item.path;
    card.append(thumb, name, path); card.onclick = () => navigate(activeRepo, item.path); $('diagram-list').append(card); cards.push({ thumb, item, index });
  }
  for (const { thumb, item, index } of cards) {
    if (generation !== thumbnails) return;
    try {
      const svg = await previews.render({ repo: activeRepo, path: item.path, source: item.source, id: `thumb${generation}_${index}` });
      if (generation === thumbnails) thumb.innerHTML = svg;
    }
    catch { if (generation === thumbnails) thumb.textContent = '描画できません · ソースを確認'; }
  }
}
async function render() {
  const current = ++revision; ++thumbnails; viewer.close();
  const screen = parseScreen(location.pathname);
  const repoId = screen?.repo || ''; selected = screen?.diagram || '';
  document.body.classList.toggle('detail-mode', Boolean(selected));
  $('error').hidden = true; $('breadcrumbs').replaceChildren(); $('workspaces').hidden = $('diagrams').hidden = $('detail').hidden = true; $('code').hidden = true;
  breadcrumb('ワークスペース', repoId ? link() : '');
  if (!screen) { heading('NOT FOUND', 'ページが見つかりません', 'ワークスペース一覧から選び直してください。'); breadcrumb('一覧へ戻る', link()); return; }
  if (!repoId) { activeRepo = ''; heading('01 / WORKSPACES', 'ワークスペース', '設計を見たいワークスペースを選んでください。'); $('workspaces').hidden = false; workspaceCards(); return; }
  const repo = repositories.find(item => item.id === repoId);
  if (!repo) { heading('WORKSPACE', 'ワークスペースが見つかりません', '一覧から選び直してください。'); return; }
  separator(); breadcrumb(repo.name, selected ? link(repoId) : '');
  heading(selected ? '03 / DIAGRAM' : '02 / DIAGRAM GALLERY', selected ? '図を読み込み中…' : repo.name, selected ? selected : 'プレビューから図を選んでください。');
  activeRepo = repoId;
  try {
    const cached = cache.get(repoId);
    const usable = cached && (selected || cached.every(item => typeof item.source === 'string'));
    const items = usable ? cached : await api(`/api/repositories/${repoId}/diagrams${selected ? '?metadata=1' : ''}`);
    if (current !== revision) return;
    cache.set(repoId, items); diagrams = items;
    if (!selected) { $('diagrams').hidden = false; catalog(); return; }
    const item = diagrams.find(item => item.path === selected);
    if (!item) throw new Error('図が見つかりません。図の一覧へ戻ってください。');
    separator(); breadcrumb(item.name); heading('03 / DIAGRAM', item.name, item.path);
    $('detail').hidden = false; $('code').hidden = true;
    $('kind').textContent = item.kind || rendererFor(item.path).label; $('position').textContent = `${diagrams.indexOf(item) + 1} / ${diagrams.length}`;
    $('prev').disabled = diagrams.indexOf(item) === 0; $('next').disabled = diagrams.indexOf(item) === diagrams.length - 1;
    await viewer.open(repoId, selected);
  } catch (error) { if (current === revision) failure(error); }
}
$('breadcrumbs').onclick = event => { const anchor = event.target.closest('a'); if (anchor && !event.metaKey && !event.ctrlKey && !event.shiftKey) { event.preventDefault(); if (!viewer.canLeave()) return; history.pushState(null, '', anchor.href); render(); } };
$('search').oninput = catalog;
$('refresh').onclick = async () => { if (!viewer.canLeave()) return; try { repositories = await api('/api/repositories'); cache.clear(); await render(); } catch (error) { failure(error); } };

function step(delta) { if ($('detail').hidden) return; const index = diagrams.findIndex(item => item.path === selected); if (diagrams[index + delta]) navigate(activeRepo, diagrams[index + delta].path); }
$('prev').onclick = () => step(-1); $('next').onclick = () => step(1);
document.addEventListener('keydown', event => { if (['INPUT', 'TEXTAREA'].includes(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return; if (event.key === 'ArrowLeft') step(-1); if (event.key === 'ArrowRight') step(1); });
let acceptedUrl = location.href;
window.addEventListener('popstate', () => { if (!viewer.canLeave()) { history.pushState(null, '', acceptedUrl); return; } render(); acceptedUrl = location.href; });
const originalPush = history.pushState.bind(history); history.pushState = (...args) => { originalPush(...args); acceptedUrl = location.href; };
try { repositories = await api('/api/repositories'); await render(); } catch (error) { failure(error); }
