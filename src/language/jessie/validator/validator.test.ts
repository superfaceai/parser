import { ForbiddenConstructProtoError, validateScript } from './validator';

// Declare custom matcher for sake of Typescript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidScript(...errors: string[]): R;
    }
  }
}
// Add the actual custom matcher
expect.extend({
  toBeValidScript(script: string, ...errors: string[]) {
    function formatError(err: ForbiddenConstructProtoError): string {
      const hint = err.hint ?? 'not provided';

      return `${err.detail} (hint: ${hint})`;
    }

    const protoErrors = validateScript(script);

    let pass = true;
    let message = '';

    if (this.isNot) {
      // Expecting to fail
      pass = false; // Flip

      if (protoErrors.length === 0) {
        pass = !pass;
        message = 'expected to fail';
      } else {
        for (let i = 0; i < errors.length; i++) {
          const err = protoErrors[i];
          if (
            !err.detail.includes(errors[i]) &&
            !err.hint?.includes(errors[i])
          ) {
            pass = !pass;
            message = `expected to find hint "${errors[i]}" in "${formatError(
              err
            )}"`;
            break;
          }
        }
      }
    } else {
      // Expecting to pass
      if (protoErrors.length > 0) {
        pass = !pass;
        const messages = protoErrors
          .map(err => `\n\t${formatError(err)}`)
          .join('');
        message = `expected to pass, errors: ${messages}`;
      }
    }

    return {
      pass,
      message: (): string => message,
    };
  },
});

describe('validator', () => {
  describe('validateScript', () => {
    test.each([
      ['empty statement', ';', ['EmptyStatement construct is not supported']],
      [
        'non-strict equality',
        '1 == 1 && 1 != 2',
        ['Use `1 === 1` instead', 'Use `1 !== 2` instead'],
      ],
      [
        'prefix ++ and --',
        `
        let x = 1;
        ++x;
        --x;
        `,
        ['Use `x += 1` or `x++` instead', 'Use `x -= 1` or `x--` instead'],
      ],
      [
        'function declarations',
        'function foo(a, b) {}',
        ['Use `const foo = (a, b) => { /* body */ }` instead'],
      ],
      [
        'var keyword',
        'var x = 45',
        ['Use `const x = 45` or `let x = 45` instead'],
      ],
      [
        'import and export',
        `
        import "foo";
        export {};
        `,
        [
          'ImportDeclaration construct is not supported',
          'ExportDeclaration construct is not supported',
        ],
      ],
      [
        'exceptions',
        `
        try {
          throw "exception";
        } catch (ex) {} finally {}
        `,
        [
          'TryStatement construct is not supported',
          'ThrowStatement construct is not supported',
          'CatchClause construct is not supported',
        ],
      ],
      [
        'classes, instantiation and this',
        `
        class Foo {
          constructor() {
            this.foo = 1;
          }
        }
        let x = new Foo();
        `,
        [
          'ClassDeclaration construct is not supported',
          'Constructor construct is not supported',
          'ThisKeyword construct is not supported',
          'NewExpression construct is not supported',
        ],
      ],
      [
        'for/in statement',
        `
        const o = { a: 1, b: 2, c: 3 }
        for (let key in o) {}
        `,
        ['ForInStatement construct is not supported'],
      ],
      [
        'with statement',
        `
        const a = { a: 1, b: 2, c: 3 }
        with (a) {}
        `,
        ['WithStatement construct is not supported'],
      ],
    ])('ForbidenConstructs: %s', (_name, script: string, errors: string[]) => {
      expect(script).not.toBeValidScript(...errors);
    });

    test.each([
      [
        'JSON',
        '{ "a": 1, "b": true, "c": "hi", "d": null, "e": [1, "a"], "f": { "a": -1 } }',
      ],
      [
        'const, let and assignment operators',
        `
        const x = 41;
        let y = 43;
        y += 2;
        y -= 2;
        y *= 2;
        y /= 2;
        `,
      ],
      ['arithmetic', '-1 + (+2) - 3 / 4 * 5 % 6 ** 2'],
      [
        'postfix ++ and --',
        `
        let x = 0;
        x++;
        x--;
        `,
      ],
      ['bitwise', '~1 & 2 | 3 ^ 4 >> 1 << 2 >>> 3'],
      [
        'comparison (but only strict equality)',
        '1 < 2 <= 3 > 4 >= 5 === 6 !== 7',
      ],
      [
        'destructuring',
        `
        const { x, y, z } = { x: 1, y: 2, z: "foo" }
        const [a, b, c] = [1, 2, "foo"]
        `,
      ],
      [
        'spreading',
        `
        const x = { "a": 1, "b": 2 }
        const y = { ...x, "a": 3 }
        const a = [1, 2, 3]
        const b = [...a, 4, 5]
        `,
      ],
      [
        'arrow functions, calls and returns',
        `
        const foo = (x) => {
          if (x === 0) return 0;
          return x + foo(x - 1],
        }
        `,
      ],
      ['rest parameter', '(x, ...rest) => rest.length'],
      ['template strings', '(x, y) => `${x} and ${y}`'],
      [
        'loops',
        `
        const a = [1, 2, 3]
        
        for (let x of a) {}
        for (let i = 0; i < a.length; i += 1) {
          let x = a[i]
        }
        
        label: while (true) {
          break label;
        }
        do {
          continue;
        } while (false)
        `,
      ],
      [
        'conditionals',
        `
        if (true && true) {} else {}
        switch (1) {
          case 2:
            break;
          case 3:
            break;
          default:
            break;
        }
        let x = (true || false) ? 1 : 2
        `,
      ],
    ])('Valid scripts: %s', (_name, script) => {
      expect(script).toBeValidScript();
    });

    it('returns correct error', () => {
      const script = 'Object.keys(something).map(name => ({ name, foo: foo }))';

      const errors = validateScript(script);

      expect(errors.length).toBe(1);
      expect(errors[0]).toStrictEqual({
        category: 'Jessie validation',
        detail: 'ShorthandPropertyAssignment construct is not supported',
        hint: 'Use `{ name: name, foo: foo }` instead',
        relativeSpan: {
          start: 38,
          end: 42,
        },
      });
    });
  });
});
