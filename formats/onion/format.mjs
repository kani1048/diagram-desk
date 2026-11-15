import { validateOnion } from './validation.mjs';
export const onionFormat = Object.freeze({
  id: 'onion', extension: '.onion.json', label: 'Onion Architecture', editorLabel: 'Onion JSON',
  kind: () => 'Onion Architecture', stylesheet: '/formats/onion/style.css',
  documentation: '/formats/onion/README.md', schema: '/formats/onion/schema.json',
  validate: validateOnion,
  loadRenderer: () => import('./renderer.mjs').then(module => module.onionRenderer),
});
