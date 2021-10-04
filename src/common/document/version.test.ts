import { VersionRange } from '.';

describe('Version helper', () => {
  describe('when creating VersionRange from string', () => {
    it('creates correct object', () => {
      expect(VersionRange.fromString('1.0.0-label')).toEqual(
        VersionRange.fromParameters({
          major: 1,
          minor: 0,
          patch: 0,
          label: 'label',
        })
      );
      expect(VersionRange.fromString('1.2.3')).toEqual(
        VersionRange.fromParameters({
          major: 1,
          minor: 2,
          patch: 3,
          label: undefined,
        })
      );

      expect(VersionRange.fromString('1.2.')).toEqual(
        VersionRange.fromParameters({
          major: 1,
          minor: 2,
          patch: undefined,
          label: undefined,
        })
      );

      expect(VersionRange.fromString('1.2')).toEqual(
        VersionRange.fromParameters({
          major: 1,
          minor: 2,
          patch: undefined,
          label: undefined,
        })
      );

      expect(VersionRange.fromString('1.')).toEqual(
        VersionRange.fromParameters({
          major: 1,
          minor: undefined,
          patch: undefined,
          label: undefined,
        })
      );

      expect(VersionRange.fromString('1')).toEqual(
        VersionRange.fromParameters({
          major: 1,
          minor: undefined,
          patch: undefined,
          label: undefined,
        })
      );
    });

    it('throws error', () => {
      expect(() => VersionRange.fromString('1.0.L')).toThrowError(
        new Error(
          'Invalid version range: 1.0.L - patch component: L is not a valid number'
        )
      );

      expect(() => VersionRange.fromString('1.L.0')).toThrowError(
        new Error(
          'Invalid version range: 1.L.0 - minor component: L is not a valid number'
        )
      );

      expect(() => VersionRange.fromString('L.0.0')).toThrowError(
        new Error(
          'Invalid version range: L.0.0 - major component: L is not a valid number'
        )
      );

      expect(() => VersionRange.fromString('.')).toThrowError(
        new Error(
          'Invalid version range: . - major component:  is not a valid number'
        )
      );

      expect(() => VersionRange.fromString('')).toThrowError(
        new Error(
          'Invalid version range:  - major component:  is not a valid number'
        )
      );
    });
  });

  describe('when creating VersionRange from parameters', () => {
    it('creates correct object', () => {
      expect(
        VersionRange.fromParameters({
          major: 1,
          minor: 0,
          patch: 0,
          label: 'label',
        }).toString()
      ).toEqual('1.0.0-label');
      expect(
        VersionRange.fromParameters({
          major: 1,
          minor: 2,
          patch: 3,
          label: undefined,
        }).toString()
      ).toEqual('1.2.3');
      expect(
        VersionRange.fromParameters({
          major: 1,
          minor: 2,
          patch: undefined,
          label: undefined,
        }).toString()
      ).toEqual('1.2');
      expect(
        VersionRange.fromParameters({
          major: 1,
          minor: undefined,
          patch: undefined,
          label: undefined,
        }).toString()
      ).toEqual('1');
    });

    it('throws error', () => {
      expect(() =>
        VersionRange.fromParameters({
          major: 1,
          minor: undefined,
          patch: 0,
          label: 'label',
        })
      ).toThrowError(
        'Invalid Version Range - patch version cannot appear without minor version'
      );
    });
  });
});
