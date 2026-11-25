import { describe, it, expect } from 'vitest';
import { fechaValida } from './fecha.js';
describe('fechaValida', () => {
  it.each([
    '2026-02-30T10:00:00Z',
    '2026-02-29T10:00:00Z',
    '2026-11-24T24:00:00Z',
    '2026-11-24T10:00:00',
    null,
  ])('rechaza fecha inexistente o incompleta: %s', (v) =>
    expect(fechaValida(v)).toBe(false),
  );
  it.each(['2024-02-29T10:00:00Z', '2026-11-24T10:00:00-06:00'])(
    'acepta fecha válida: %s',
    (v) => expect(fechaValida(v)).toBe(true),
  );
});
