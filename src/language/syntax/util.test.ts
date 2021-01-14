import { extractDocumentation } from './util';

describe('extract documentation', () => {
  it('should extract nothing from undefined', () => {
    expect(extractDocumentation(undefined)).toBeUndefined();
  });

  it('should extract nothing from empty or whitespace-only', () => {
    expect(extractDocumentation('')).toBeUndefined();
    expect(extractDocumentation('   \t    \t\n\n\t   ')).toBeUndefined();
  });

  it('should extract title from single line', () => {
    const title = 'This is the title, it does not contain newlines';
    expect(extractDocumentation(title)).toStrictEqual({
      title,
    });
  });

  it('should extract title and description from multiline', () => {
    const title = 'This is the title, it does not contain newlines';
    const description =
      'This is \n the description, it does \n contain \n some newlines';
    expect(
      extractDocumentation(title + '\n' + '  \t\n' + description)
    ).toStrictEqual({
      title,
      description,
    });
  });
});
