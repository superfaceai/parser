import { Lexer } from './lexer/lexer';
import { Source } from './source';

describe('langauge syntax errors', () => {
  describe('lexer', () => {
    // Allow this lint error because we want to call `format` on the error object and check the output line-by-line
    /* eslint-disable jest/no-try-expect */
    it('before', () => {
      const lexer = new Lexer(new Source('before\n\t@safes'));

      try {
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
      } catch (e) {
        const formatLines = e.format().split('\n');
        expect(formatLines[0]).toMatch(
          'SyntaxError: Expected one of [safe, unsafe, idempotent]'
        );

        expect(formatLines[1]).toMatch(' --> [input]:2:2');

        expect(formatLines[2]).toMatch('1 | before');
        expect(formatLines[3]).toMatch('2 | \t@safes');
        expect(formatLines[4]).toMatch(' | \t^^    ');
      }
    });

    it('after', () => {
      const lexer = new Lexer(new Source('\t0xx\nafter'));
      try {
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
      } catch (e) {
        const formatLines = e.format().split('\n');
        expect(formatLines[0]).toMatch(
          'SyntaxError: Expected a number following integer base prefix'
        );

        expect(formatLines[1]).toMatch(' --> [input]:1:2');

        expect(formatLines[2]).toMatch('1 | \t0xx');
        expect(formatLines[3]).toMatch(' | \t^^^');
        expect(formatLines[4]).toMatch('2 | after');
      }
    });

    it('before and after', () => {
      const lexer = new Lexer(new Source('before\n\t@safes\nafter'));
      try {
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
      } catch (e) {
        const formatLines = e.format().split('\n');
        expect(formatLines[0]).toMatch(
          'SyntaxError: Expected one of [safe, unsafe, idempotent]'
        );

        expect(formatLines[1]).toMatch(' --> [input]:2:2');

        expect(formatLines[2]).toMatch('1 | before');
        expect(formatLines[3]).toMatch('2 | \t@safes');
        expect(formatLines[4]).toMatch(' | \t^^    ');
        expect(formatLines[5]).toMatch('3 | after');
      }
    });

    it('neither before nor after', () => {
      const lexer = new Lexer(new Source('\t@safes'));
      try {
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
        lexer.advance();
      } catch (e) {
        const formatLines = e.format().split('\n');
        expect(formatLines[0]).toMatch(
          'SyntaxError: Expected one of [safe, unsafe, idempotent]'
        );

        expect(formatLines[1]).toMatch(' --> [input]:1:2');

        expect(formatLines[2]).toMatch('1 | \t@safes');
        expect(formatLines[3]).toMatch(' | \t^^    ');
      }
    });

    /* eslint-enable jest/no-try-expect */
  });
});
