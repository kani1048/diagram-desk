// Workspace navigation does not need the diagram engine.
let engine;
export function loadMermaid() {
  engine ??= import('/vendor/mermaid.esm.min.mjs').then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', htmlLabels: false, flowchart: { htmlLabels: false, wrappingWidth: 260 }, class: { htmlLabels: false } });
    return mermaid;
  }).catch(error => { engine = undefined; throw error; });
  return engine;
}
export default { async render(...args) { return (await loadMermaid()).render(...args); } };
