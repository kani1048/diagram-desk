import { analyzeOnion } from './adapters/onion.mjs';
import { validateDDD } from './rulesets/ddd/rules.mjs';
// Support is declared on the validation side; formats never register policies.
export const RULESETS = Object.freeze([
  Object.freeze({
    id: 'ddd', label: 'DDD aggregate boundaries',
    documentation: 'validation/rulesets/ddd/README.md',
    configurationSchema: 'validation/rulesets/ddd/schema.json',
    supports: Object.freeze({ onion: analyzeOnion }), validate: validateDDD,
  }),
]);
export const describeRulesets = (registry = RULESETS) => registry.map(({ id, label, supports, documentation, configurationSchema }) => ({
  id, label, supports: Object.keys(supports), documentation, configurationSchema,
}));
