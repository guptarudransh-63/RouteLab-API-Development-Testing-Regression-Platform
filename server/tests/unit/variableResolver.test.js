import {
  mergeVariableScopes,
  resolveStringVariables,
  resolveDeepVariables,
  UnresolvedVariableError,
} from '../../src/services/variableResolver.js';

describe('Variable Resolver Service', () => {
  it('should respect scope hierarchy (runtime > request > collection > environment)', () => {
    const environmentVars = [{ key: 'apiUrl', value: 'https://env.example.com' }, { key: 'token', value: 'env_token' }];
    const collectionVars = [{ key: 'token', value: 'coll_token' }, { key: 'version', value: 'v1' }];
    const runtimeVars = { token: 'runtime_token' };

    const merged = mergeVariableScopes({
      environmentVars,
      collectionVars,
      runtimeVars,
    });

    expect(merged.apiUrl).toBe('https://env.example.com');
    expect(merged.version).toBe('v1');
    expect(merged.token).toBe('runtime_token'); // Overridden by runtime
  });

  it('should resolve variables in string templates', () => {
    const template = '{{baseUrl}}/users/{{userId}}?api_key={{apiKey}}';
    const variables = {
      baseUrl: 'https://api.github.com',
      userId: 'usr_42',
      apiKey: 'k_999',
    };

    const resolved = resolveStringVariables(template, variables);
    expect(resolved).toBe('https://api.github.com/users/usr_42?api_key=k_999');
  });

  it('should resolve built-in dynamic variables', () => {
    const template = 'test_{{$guid}}_{{$timestamp}}_{{$randomInt}}';
    const resolved = resolveStringVariables(template, {});

    expect(resolved).not.toContain('{{$guid}}');
    expect(resolved).not.toContain('{{$timestamp}}');
    expect(resolved).not.toContain('{{$randomInt}}');
    expect(resolved.startsWith('test_')).toBe(true);
  });

  it('should throw UnresolvedVariableError in strict mode when variables are missing', () => {
    const template = '{{baseUrl}}/users/{{missingId}}';
    const variables = { baseUrl: 'https://api.test' };

    expect(() => {
      resolveStringVariables(template, variables, { strict: true });
    }).toThrow(UnresolvedVariableError);
  });

  it('should recursively resolve variables in deep objects', () => {
    const deepObj = {
      url: '{{baseUrl}}/items',
      payload: {
        id: '{{itemId}}',
        tags: ['{{tag}}', 'fixed'],
      },
    };

    const variables = {
      baseUrl: 'http://test',
      itemId: 'item_1',
      tag: 'urgent',
    };

    const resolved = resolveDeepVariables(deepObj, variables);
    expect(resolved.url).toBe('http://test/items');
    expect(resolved.payload.id).toBe('item_1');
    expect(resolved.payload.tags).toEqual(['urgent', 'fixed']);
  });
});
