import { describe, expect, it } from 'vitest';
import { buildPathWithParams, buildSampleFromSchema, pickFirstEndpoint } from './endpoint';

describe('buildPathWithParams', () => {
  it('replaces placeholders without mutating template', () => {
    const template = '/api/v2/users/{userId}/profile/{section}';
    const result = buildPathWithParams(template, { userId: 'user 123', section: 'settings' });
    expect(result).toBe('/api/v2/users/user%20123/profile/settings');
  });
});

describe('buildSampleFromSchema', () => {
  it('creates a nested object with defaults', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        active: { type: 'boolean', default: true },
        metrics: {
          type: 'array',
          items: { type: 'integer' },
        },
      },
    };

    const result = buildSampleFromSchema(schema);
    expect(result.id).toBe('00000000-0000-0000-0000-000000000000');
    expect(result.active).toBe(true);
    expect(result.metrics).toEqual([0]);
  });
});

describe('pickFirstEndpoint', () => {
  it('returns the first available method in priority order', () => {
    const spec = {
      '/foo': {
        post: { summary: 'Create' },
      },
      '/bar': {
        get: { summary: 'Read' },
      },
    };
    const first = pickFirstEndpoint(spec);
    expect(first.path).toBe('/bar');
    expect(first.method).toBe('get');
  });
});
