import { ProfileId } from './profile';

describe('ProfileId helper', () => {
  describe('when creating ProfileId from id', () => {
    it('creates correct object', () => {
      expect(ProfileId.fromId('scope/test@1.0.0').toString()).toEqual(
        'scope/test'
      );

      expect(ProfileId.fromId('test').toString()).toEqual('test');

      expect(() => ProfileId.fromId('0!K:')).toThrowError(
        new Error(
          'Invalid profile id: "0!K:" is not a valid lowercase identifier'
        )
      );
    });
  });

  describe('when creating ProfileId from name', () => {
    it('creates correct object', () => {
      expect(ProfileId.fromScopeName(undefined, 'test').toString()).toEqual(
        'test'
      );

      expect(ProfileId.fromScopeName('scope', 'test').toString()).toEqual(
        'scope/test'
      );
    });
  });

  describe('when getting ProfileId id with version', () => {
    it('returns correct id', () => {
      expect(
        ProfileId.fromScopeName(undefined, 'test').withVersion('1.0.0')
      ).toEqual('test@1.0.0');

      expect(ProfileId.fromScopeName('scope', 'test').withVersion()).toEqual(
        'scope/test'
      );
    });
  });
});
