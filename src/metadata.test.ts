import { parseMetadataVersion } from './metadata';

describe('metadata parsing', () => {
  it('should parse normal semver', () => {
    expect(parseMetadataVersion('1.2.34')).toStrictEqual({
      major: 1,
      minor: 2,
      patch: 34,
      label: undefined,
    });
  });

  it('should parse beta semver', () => {
    expect(parseMetadataVersion('1.2.34-beta.1')).toStrictEqual({
      major: 1,
      minor: 2,
      patch: 34,
      label: 'beta.1',
    });
  });

  it('should handle git hash version', () => {
    expect(parseMetadataVersion('git+c0e519e')).toStrictEqual({
      major: 0,
      minor: 0,
      patch: 0,
      label: 'c0e519e',
    });
  });
});
