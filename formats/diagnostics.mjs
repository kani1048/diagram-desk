export class DiagramValidationError extends Error {
  constructor(diagnostics) {
    super(diagnostics.map(item => `${item.path || '/'}: ${item.message}`).join('\n'));
    this.name = 'DiagramValidationError';
    this.diagnostics = diagnostics;
  }
}
export const diagnostic = (code, path, message) => ({ severity: 'error', code, path, message });
