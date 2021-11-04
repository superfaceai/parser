import { computeEndLocation, Source } from './source';

test('computeEndLocation should compute end location correctly', () => {
  const result = computeEndLocation('123\n\n6', {
    line: 12,
    column: 24,
    charIndex: 50,
  });

  expect(result).toStrictEqual({ line: 14, column: 2, charIndex: 56 });
});

test('Source::checksum should compute correct checksum', () => {
  const result = new Source('hello world, give me a checksum').checksum();

  expect(result).toBe(
    '788a4a5382e776daf96c7f70c309094afd15e70cdc911dc305f9c4902ed58d40'
  );
});
