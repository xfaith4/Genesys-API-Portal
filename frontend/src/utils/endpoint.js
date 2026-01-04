export const methodPriority = ['get', 'post', 'put', 'patch', 'delete'];

export function buildPathWithParams(template, params = {}) {
  let path = template;
  Object.entries(params).forEach(([key, value]) => {
    const safeValue = value != null ? encodeURIComponent(value) : '';
    path = path.replace(new RegExp(`{${key}}`, 'gi'), safeValue);
  });
  return path;
}

export function buildSampleFromSchema(schema) {
  if (!schema) {
    return {};
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  if (Array.isArray(schema.enum) && schema.enum.length) {
    return schema.enum[0];
  }

  const type = schema.type || (schema.properties ? 'object' : 'string');

  switch (type) {
    case 'object': {
      const obj = {};
      const props = schema.properties || {};
      Object.entries(props).forEach(([key, value]) => {
        obj[key] = buildSampleFromSchema(value);
      });
      return obj;
    }
    case 'array':
      return [buildSampleFromSchema(schema.items || {})];
    case 'boolean':
      return schema.default ?? false;
    case 'integer':
    case 'number':
      return schema.default ?? 0;
    case 'string':
    default:
      if (schema.format === 'uuid') {
        return '00000000-0000-0000-0000-000000000000';
      }
      return schema.default ?? 'string';
  }
}

export function pickFirstEndpoint(paths = {}) {
  const sorted = Object.keys(paths).sort();
  for (const path of sorted) {
    const methods = paths[path];
    for (const method of methodPriority) {
      if (methods[method]) {
        return {
          path,
          method,
          operation: methods[method],
        };
      }
    }
  }
  return null;
}
