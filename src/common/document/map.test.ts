import { ProfileId, ProfileVersion } from '.';
import { MapId, MapVersion } from './map';
import { VersionRange } from './version';

describe('MapId helper', () => {
  describe('when creating MapVersion from VersionRange', () => {
    it('creates correct object', () => {
      expect(
        MapVersion.fromVersionRange(
          VersionRange.fromParameters({
            major: 1,
            minor: 0,
            patch: 0,
            label: 'rev2',
          })
        )
      ).toEqual(
        MapVersion.fromParameters({
          major: 1,
          minor: 0,
          revision: 2,
        })
      );
      expect(
        MapVersion.fromVersionRange(
          VersionRange.fromParameters({
            major: 1,
            minor: 2,
            patch: 3,
          })
        )
      ).toEqual(
        MapVersion.fromParameters({
          major: 1,
          minor: 2,
        })
      );
    });
    it('throws error', () => {
      expect(() =>
        MapVersion.fromVersionRange(
          VersionRange.fromParameters({
            major: 1,
          })
        )
      ).toThrowError(
        new Error('Invalid map version: 1 - minor version is required')
      );
      expect(() =>
        MapVersion.fromVersionRange(
          VersionRange.fromParameters({
            major: 1,
            minor: 2,
            patch: 4,
            label: '78',
          })
        )
      ).toThrowError(
        new Error(
          'Invalid map version: 1.2.4-78 - revision has error: revision label must be in format `revN`'
        )
      );
    });
  });

  describe('when creating MapVersion from string', () => {
    it('creates correct object', () => {
      expect(MapVersion.fromString('1.0-rev0')).toEqual(
        MapVersion.fromParameters({
          major: 1,
          minor: 0,
          revision: 0,
        })
      );
      expect(MapVersion.fromString('1.0-rev123')).toEqual(
        MapVersion.fromParameters({
          major: 1,
          minor: 0,
          revision: 123,
        })
      );
      expect(MapVersion.fromString('1.2')).toEqual(
        MapVersion.fromParameters({
          major: 1,
          minor: 2,
        })
      );
    });

    it('throws error', () => {
      expect(() => MapVersion.fromString('1.L')).toThrowError(
        new Error(
          'Invalid map version: 1.L - minor component: L is not a valid number'
        )
      );

      expect(() => MapVersion.fromString('1.')).toThrowError(
        new Error(
          'Invalid map version: 1. - minor component:  is not a valid number'
        )
      );
      expect(() => MapVersion.fromString('1')).toThrowError(
        new Error(
          'Invalid map version: 1 - minor component: undefined is not a valid number'
        )
      );

      expect(() => MapVersion.fromString('L.0.0')).toThrowError(
        new Error(
          'Invalid map version: L.0.0 - major component: L is not a valid number'
        )
      );

      expect(() => MapVersion.fromString('.')).toThrowError(
        new Error(
          'Invalid map version: . - major component:  is not a valid number'
        )
      );

      expect(() => MapVersion.fromString('')).toThrowError(
        new Error(
          'Invalid map version:  - major component:  is not a valid number'
        )
      );
      expect(() => MapVersion.fromString('1.2-rev')).toThrowError(
        new Error(
          'Invalid map version: 1.2-rev - revision has error: revision label must be in format `revN` where N is a non-negative integer'
        )
      );
    });
  });

  describe('when creating MapVersion from parameters', () => {
    it('creates correct object', () => {
      expect(
        MapVersion.fromParameters({
          major: 1,
          minor: 0,
          revision: 0,
        }).toString()
      ).toEqual('1.0-rev0');
      expect(
        MapVersion.fromParameters({
          major: 1,
          minor: 2,
          revision: 1000,
        }).toString()
      ).toEqual('1.2-rev1000');
      expect(
        MapVersion.fromParameters({
          major: 1,
          minor: 2,
        }).toString()
      ).toEqual('1.2');
    });
  });

  describe('when creating MapId from parameters', () => {
    it('creates correct object', () => {
      expect(
        MapId.fromParameters({
          profile: ProfileId.fromParameters({
            name: 'test',
            version: ProfileVersion.fromString('1.0.0'),
          }),
          version: MapVersion.fromString('1.0'),
          provider: 'provider',
        }).toString()
      ).toEqual('test.provider@1.0');

      expect(
        MapId.fromParameters({
          profile: ProfileId.fromParameters({
            name: 'test',
            scope: 'scope',
            version: ProfileVersion.fromString('1.2.3'),
          }),
          version: MapVersion.fromString('1.2-rev4'),
          provider: 'provider',
          variant: 'bugfix',
        }).toString()
      ).toEqual('scope/test.provider.bugfix@1.2-rev4');
    });
    it('throws error', () => {
      expect(() =>
        MapId.fromParameters({
          profile: ProfileId.fromParameters({
            name: 'test',
            scope: 'scope',
            version: ProfileVersion.fromString('1.7.8'),
          }),
          version: MapVersion.fromString('1.2-rev4'),
          provider: 'provider',
          variant: 'bugfix',
        })
      ).toThrowError(
        new Error(
          'Invalid map id - minor component of map version: 2 and minor component of profile version: 7 does not match'
        )
      );

      expect(() =>
        MapId.fromParameters({
          profile: ProfileId.fromParameters({
            name: 'test',
            scope: 'scope',
          }),
          version: MapVersion.fromString('1.2-rev4'),
          provider: 'provider',
          variant: 'bugfix',
        })
      ).toThrowError(
        new Error(
          'Invalid map id - map version: 1.2-rev4 and undefined profile version does not match'
        )
      );
      expect(() =>
        MapId.fromParameters({
          profile: ProfileId.fromParameters({
            name: 'test',
            scope: 'scope',
            version: ProfileVersion.fromString('1.7.0'),
          }),
          version: MapVersion.fromString('2.2-rev4'),
          provider: 'provider',
          variant: 'bugfix',
        })
      ).toThrowError(
        new Error(
          'Invalid map id - major component of map version: 2 and major component of profile version: 1 does not match'
        )
      );
    });
  });

  describe('when getting MapId id with version', () => {
    it('returns correct id', () => {
      expect(
        MapId.fromParameters({
          profile: ProfileId.fromParameters({
            name: 'test',
            scope: 'scope',
            version: ProfileVersion.fromString('1.9.0-test'),
          }),
          version: MapVersion.fromString('1.9'),
          provider: 'provider',
          variant: 'bugfix',
        }).toString()
      ).toEqual('scope/test.provider.bugfix@1.9');

      expect(
        MapId.fromParameters({
          profile: ProfileId.fromParameters({
            name: 'test',
            scope: 'scope',
            version: ProfileVersion.fromString('1.9.0'),
          }),
          version: MapVersion.fromString('1.9-rev8'),
          provider: 'provider',
          variant: 'bugfix',
        }).toString()
      ).toEqual('scope/test.provider.bugfix@1.9-rev8');
    });
  });
});
