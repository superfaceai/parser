import { extractDocumentation } from './util';

describe('extract documentation', () => {
  it('should extract nothing from undefined', () => {
    expect(extractDocumentation(undefined)).toStrictEqual({});
  });

  it('should extract nothing from empty or whitespace-only', () => {
    expect(extractDocumentation('')).toStrictEqual({});
    expect(extractDocumentation('   \t    \t\n\n\t   ')).toStrictEqual({});
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
