import { DEFAULT_PROFILE_VERSION, ProfileVersion, VersionRange } from '.';
import { ProfileId } from './profile';

describe('Profile helper', () => {
  describe('when creating ProfileVersion from VersionRange', () => {
    it('creates correct object', () => {
      expect(
        ProfileVersion.fromVersionRange(
          VersionRange.fromParameters({
            major: 1,
            minor: 0,
            patch: 0,
            label: 'label',
          })
        )
      ).toEqual(
        ProfileVersion.fromParameters({
          major: 1,
          minor: 0,
          patch: 0,
          label: 'label',
        })
      );
      expect(
        ProfileVersion.fromVersionRange(
          VersionRange.fromParameters({
            major: 1,
            minor: 2,
            patch: 3,
          })
        )
      ).toEqual(
        ProfileVersion.fromParameters({
          major: 1,
          minor: 2,
          patch: 3,
          label: undefined,
        })
      );
    });
    it('throws error', () => {
      expect(() =>
        ProfileVersion.fromVersionRange(
          VersionRange.fromParameters({
            major: 1,
            minor: 0,
          })
        )
      ).toThrowError(
        new Error('Invalid profile version: 1.0 - patch version is required')
      );
      expect(() =>
        ProfileVersion.fromVersionRange(
          VersionRange.fromParameters({
            major: 1,
          })
        )
      ).toThrowError(
        new Error('Invalid profile version: 1 - minor version is required')
      );
    });
  });

  describe('when creating ProfileVersion from string', () => {
    it('creates correct object', () => {
      expect(ProfileVersion.fromString('1.0.0-label')).toEqual(
        ProfileVersion.fromParameters({
          major: 1,
          minor: 0,
          patch: 0,
          label: 'label',
        })
      );
      expect(ProfileVersion.fromString('1.2.3')).toEqual(
        ProfileVersion.fromParameters({
          major: 1,
          minor: 2,
          patch: 3,
          label: undefined,
        })
      );
    });

    it('throws error', () => {
      expect(() => ProfileVersion.fromString('1.0.L')).toThrowError(
        new Error(
          'Invalid profile version: 1.0.L - patch component: L is not a valid number'
        )
      );
      expect(() => ProfileVersion.fromString('1.0.')).toThrowError(
        new Error(
          'Invalid profile version: 1.0. - patch component:  is not a valid number'
        )
      );
      expect(() => ProfileVersion.fromString('1.0')).toThrowError(
        new Error(
          'Invalid profile version: 1.0 - patch component: undefined is not a valid number'
        )
      );

      expect(() => ProfileVersion.fromString('1.L.0')).toThrowError(
        new Error(
          'Invalid profile version: 1.L.0 - minor component: L is not a valid number'
        )
      );
      expect(() => ProfileVersion.fromString('1.')).toThrowError(
        new Error(
          'Invalid profile version: 1. - minor component:  is not a valid number'
        )
      );
      expect(() => ProfileVersion.fromString('1')).toThrowError(
        new Error(
          'Invalid profile version: 1 - minor component: undefined is not a valid number'
        )
      );

      expect(() => ProfileVersion.fromString('L.0.0')).toThrowError(
        new Error(
          'Invalid profile version: L.0.0 - major component: L is not a valid number'
        )
      );

      expect(() => ProfileVersion.fromString('.')).toThrowError(
        new Error(
          'Invalid profile version: . - major component:  is not a valid number'
        )
      );

      expect(() => ProfileVersion.fromString('')).toThrowError(
        new Error(
          'Invalid profile version:  - major component:  is not a valid number'
        )
      );
    });
  });

  describe('when creating ProfileVersion from parameters', () => {
    it('creates correct object', () => {
      expect(
        ProfileVersion.fromParameters({
          major: 1,
          minor: 0,
          patch: 0,
          label: 'label',
        }).toString()
      ).toEqual('1.0.0-label');
      expect(
        ProfileVersion.fromParameters({
          major: 1,
          minor: 2,
          patch: 3,
          label: undefined,
        }).toString()
      ).toEqual('1.2.3');
    });
  });

  describe('when creating ProfileId from id', () => {
    it('creates correct object', () => {
      expect(ProfileId.fromId('scope/test@1.0.0').toString()).toEqual(
        'scope/test@1.0.0'
      );

      expect(ProfileId.fromId('scope/test', '1.0.0').toString()).toEqual(
        'scope/test@1.0.0'
      );

      expect(ProfileId.fromId('test').toString()).toEqual('test');

      expect(ProfileId.fromId('scope/test').toString()).toEqual('scope/test');

      expect(ProfileId.fromId('test', '1.0.0').toString()).toEqual(
        'test@1.0.0'
      );

      expect(() => ProfileId.fromId('0!K:')).toThrowError(
        new Error(
          'Invalid profile id: "0!K:" is not a valid lowercase identifier'
        )
      );

      expect(() => ProfileId.fromId('scope/name.provider')).toThrowError(
        new Error('"name.provider" is not a valid lowercase identifier')
      );
    });
  });

  describe('when creating ProfileId from name', () => {
    it('creates correct object', () => {
      expect(
        ProfileId.fromParameters({
          scope: undefined,
          version: undefined,
          name: 'test',
        }).toString()
      ).toEqual('test');

      expect(
        ProfileId.fromParameters({
          scope: 'scope',
          version: undefined,
          name: 'test',
        }).toString()
      ).toEqual('scope/test');

      expect(
        ProfileId.fromParameters({
          scope: 'scope',
          version: DEFAULT_PROFILE_VERSION,
          name: 'test',
        }).toString()
      ).toEqual('scope/test@1.0.0');
    });
  });

  describe('when getting ProfileId id without version', () => {
    it('returns correct id', () => {
      expect(
        ProfileId.fromParameters({
          scope: undefined,
          version: DEFAULT_PROFILE_VERSION,
          name: 'test',
        }).withoutVersion
      ).toEqual('test');

      expect(
        ProfileId.fromParameters({
          scope: 'scope',
          version: DEFAULT_PROFILE_VERSION,
          name: 'test',
        }).withoutVersion
      ).toEqual('scope/test');
    });
  });
});
