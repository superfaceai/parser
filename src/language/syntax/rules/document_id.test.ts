import { parseMapId, parseProfileId, parseVersion } from './document_id';

describe('document name parsing', () => {
  it('parses minimal profile name', () => {
    const id = 'my-profile';

    expect(parseProfileId(id)).toEqual({
      kind: 'parsed',
      name: 'my-profile',
    });
  });

  it('parses full profile name', () => {
    const id = 'my-sc0pe/my-profile@1.2.34';

    expect(parseProfileId(id)).toEqual({
      kind: 'parsed',
      scope: 'my-sc0pe',
      name: 'my-profile',
      version: {
        major: 1,
        minor: 2,
        patch: 34,
      },
    });
  });

  it('parses minimal map name', () => {
    const id = 'my-profile.x_prov1der';

    expect(parseMapId(id)).toEqual({
      kind: 'parsed',
      name: 'my-profile',
      provider: 'x_prov1der',
    });
  });

  it('parses full map name', () => {
    const id = 'our_scope/my-profile.x_prov1der.v4riant@1.2.34-rev567';

    expect(parseMapId(id)).toEqual({
      kind: 'parsed',
      scope: 'our_scope',
      name: 'my-profile',
      provider: 'x_prov1der',
      variant: 'v4riant',
      version: {
        major: 1,
        minor: 2,
        patch: 34,
        revision: 567,
      },
    });
  });

  it('returns an error for uppercase', () => {
    const id = 'SCOPE/profile';

    expect(parseProfileId(id)).toStrictEqual({
      kind: 'error',
      message: 'scope is not a valid lowercase identifier',
    });
  });

  it('returns an error for empty provider', () => {
    const id = 'scope/profile.@1.0.0';

    expect(parseMapId(id)).toStrictEqual({
      kind: 'error',
      message: 'provider is not a valid lowercase identifier',
    });

    expect(parseProfileId(id)).toStrictEqual({
      kind: 'error',
      message: 'name is not a valid lowercase identifier',
    });
  });

  it('returns an error for empty variant (with . present)', () => {
    const id = 'scope/profile.provider.@1.0.0';

    expect(parseMapId(id)).toStrictEqual({
      kind: 'error',
      message: 'variant is not a valid lowercase identifier',
    });

    expect(parseProfileId(id)).toStrictEqual({
      kind: 'error',
      message: 'name is not a valid lowercase identifier',
    });
  });

  it('returns an error for non-number revision', () => {
    const id = 'scope/profile.provider@1.0.0-revx';

    expect(parseMapId(id)).toStrictEqual({
      kind: 'error',
      message:
        'could not parse revision: label must be in format `revN` where N is a non-negative integer',
    });
  });

  it('returns an error for invalid version', () => {
    const version = '1.x1';
    expect(parseVersion(version)).toStrictEqual({
      kind: 'error',
      message: 'minor component is not a valid number',
    });
  });
});
