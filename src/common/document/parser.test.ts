import {
  parseDocumentId,
  parseMapId,
  parseProfileId,
  parseVersion,
} from './parser';

describe('document name parsing', () => {
  it('parses partial profile name', () => {
    const id = 'my-profile';

    expect(parseDocumentId(id)).toEqual({
      kind: 'parsed',
      value: {
        middle: ['my-profile'],
      },
    });
  });

  it('parses minimal profile name', () => {
    const id = 'my_profile@17';

    expect(parseProfileId(id)).toEqual({
      kind: 'parsed',
      value: {
        name: 'my_profile',
        version: {
          major: 17,
        },
      },
    });
  });

  it('parses full profile name', () => {
    const id = 'my-sc0pe/my-profile@1.2.34';

    expect(parseProfileId(id)).toEqual({
      kind: 'parsed',
      value: {
        scope: 'my-sc0pe',
        name: 'my-profile',
        version: {
          major: 1,
          minor: 2,
          patch: 34,
        },
      },
    });
  });

  it('parses partial map name', () => {
    const id = 'my-profile.x_prov1der';

    expect(parseDocumentId(id)).toEqual({
      kind: 'parsed',
      value: {
        middle: ['my-profile', 'x_prov1der'],
      },
    });
  });

  it('parses minimal map name', () => {
    const id = 'prof.prov@32';

    expect(parseMapId(id)).toEqual({
      kind: 'parsed',
      value: {
        name: 'prof',
        provider: 'prov',
        version: {
          major: 32,
        },
      },
    });
  });

  it('parses full map name', () => {
    const id = 'our_scope/my-profile.x_provider.v4riant@1.2-rev567';

    expect(parseMapId(id)).toEqual({
      kind: 'parsed',
      value: {
        scope: 'our_scope',
        name: 'my-profile',
        provider: 'x_provider',
        variant: 'v4riant',
        version: {
          major: 1,
          minor: 2,
          revision: 567,
        },
      },
    });
  });

  it('parses partial map name with unverified provider', () => {
    const id = 'my-profile.unverified-x_provider';

    expect(parseDocumentId(id)).toEqual({
      kind: 'parsed',
      value: {
        middle: ['my-profile', 'unverified-x_provider'],
      },
    });
  });

  it('parses full map name with unverified provider', () => {
    const id = 'our_scope/my-profile.unverified-x_provider.v4riant@1.2-rev567';

    expect(parseMapId(id)).toEqual({
      kind: 'parsed',
      value: {
        scope: 'our_scope',
        name: 'my-profile',
        provider: 'unverified-x_provider',
        variant: 'v4riant',
        version: {
          major: 1,
          minor: 2,
          revision: 567,
        },
      },
    });
  });

  it('returns an error for uppercase', () => {
    const id = 'SCOPE/profile';

    expect(parseDocumentId(id)).toStrictEqual({
      kind: 'error',
      message: 'scope is not a valid lowercase identifier',
    });
    expect(parseProfileId(id)).toStrictEqual({
      kind: 'error',
      message: 'scope is not a valid lowercase identifier',
    });
  });

  it('returns an error for empty provider', () => {
    const id = 'scope/profile.@1.0.0';

    expect(parseMapId(id)).toStrictEqual({
      kind: 'error',
      message: '"" is not a valid lowercase identifier',
    });

    expect(parseProfileId(id)).toStrictEqual({
      kind: 'error',
      message: '"" is not a valid lowercase identifier',
    });
  });

  it('returns an error for provider with number', () => {
    const id = 'scope/profile.prov1der@1.0.0';

    expect(parseMapId(id)).toStrictEqual({
      kind: 'error',
      message: '"prov1der" is not a valid lowercase identifier',
    });
  });

  it('returns an error for unknow provider prefix is used', () => {
    const id = 'scope/profile.myprefix!provider@1.0.0';

    expect(parseMapId(id)).toStrictEqual({
      kind: 'error',
      message: '"myprefix!provider" is not a valid lowercase identifier',
    });
  });

  it('returns an error for empty variant (with . present)', () => {
    const id = 'scope/profile.provider.@1.0.0';

    expect(parseMapId(id)).toStrictEqual({
      kind: 'error',
      message: '"" is not a valid lowercase identifier',
    });

    expect(parseProfileId(id)).toStrictEqual({
      kind: 'error',
      message: '"" is not a valid lowercase identifier',
    });
  });

  it('returns an error for non-number revision', () => {
    const id = 'scope/profile.provider@1.0.0-revx';

    expect(parseMapId(id)).toStrictEqual({
      kind: 'error',
      message:
        'revision label must be in format `revN` where N is a non-negative integer',
    });
  });

  it('returns an error for invalid version - 1.x1', () => {
    const version = '1.x1';
    expect(parseVersion(version)).toStrictEqual({
      kind: 'error',
      message: 'minor component is not a valid number',
    });
  });

  it('returns an error for invalid version - 1.2.3.4', () => {
    const version = '1.2.3.4';
    expect(parseVersion(version)).toStrictEqual({
      kind: 'error',
      message: 'patch component is not a valid number',
    });
  });
});
