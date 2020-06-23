import { validateScript } from './ScriptValidator';

// Declare custom matcher for sake of Typescript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      valid(...errors: string[]): R;
    }
  }
}
// Add the actual custom matcher
expect.extend({
  valid(script: string, ...errors: string[]) {
    const report = validateScript(script);

    let pass = true;
    let message = '';

    if (this.isNot) {
      // Expecting to fail
      pass = false; // Flip

      if (report.isValid === true) {
        pass = !pass;
        message = `expected to fail`;
      } else {
        for (let i = 0; i < errors.length; i++) {
          let err = report.errors[i];
          if (
            !err.message.includes(errors[i]) &&
            !err.hint?.includes(errors[i])
          ) {
            pass = !pass;
            message = `expected to find hint "${errors[i]}" in "${err.message} (hint: ${err.hint})"`;
            break;
          }
        }
      }
    } else {
      // Expecting to pass
      if (report.isValid === false) {
        pass = !pass;
        message = `expected to pass, errors: ${report.errors
          .map(e => `\n\t${e.message} (hint: ${e.hint})`)
          .join('')}`;
      }
    }

    return {
      pass,
      message: (): string => message,
    };
  },
});

function invalid(name: string, script: string, ...errors: string[]): void {
  it(name, () => {
    expect(script).not.valid(...errors);
  });
}

function valid(name: string, script: string): void {
  it(name, () => {
    expect(script).valid();
  });
}

// prettier-ignore
describe('ScriptValidator', () => {
  describe('ForbidenConstructs', () => {
    invalid(
      'empty statement',
      ';',

      'EmptyStatement construct is not supported'
    );
    invalid(
      'non-strict equality',
      '1 == 1 && 1 != 2',

      'Use === instead',
      'Use !== instead'
    );
    invalid(
      'shorthand ++ and --',
      'let x = 1; x++ + --x + ++x + x--',

      'Use += instead',
      'Use -= instead',
      'Use += instead',
      'Use -= instead'
    );
    invalid(
      'function declarations',
      'function foo() {}',

      'Use arrow functions instead'
    );
    invalid(
      'var keyword',
      'var x = 45',

      'Use const or let instead'
    );
    invalid(
      'import and export',
      `
      import "foo";
      export {};
      `,

      'ImportDeclaration construct is not supported',
      'ExportDeclaration construct is not supported'
    );
    invalid(
      'exceptions',
      `
      try {
        throw "exception";
      } catch (ex) {} finally {}
      `,

      'TryStatement construct is not supported',
      'ThrowStatement construct is not supported',
      'CatchClause construct is not supported'
    );
    invalid(
      'classes, instantiation and this',
      `
      class Foo {
        constructor() {
          this.foo = 1;
        }
      }
      let x = new Foo();
      `,
      
      'ClassDeclaration construct is not supported',
      'Constructor construct is not supported',
      'ThisKeyword construct is not supported',
      'NewExpression construct is not supported'
    );
    invalid(
      'for/in statement',
      `
      const o = { a: 1, b: 2, c: 3 }
      for (let key in o) {}
      `,

      'ForInStatement construct is not supported'
    );
    invalid(
      'with statement',
      `
      const a = { a: 1, b: 2, c: 3 }
      with (a) {}
      `,

      'WithStatement construct is not supported'
    );
  });

  describe('Valid scripts', () => {
    valid(
      'JSON',
      `{ "a": 1, "b": true, "c": "hi", "d": null, "e": [1, "a"], "f": { "a": -1 } }`
    );
    valid(
      'const, let and assignment operators',
      `
      const x = 41;
      let y = 43;
      y += 2;
      y -= 2;
      y *= 2;
      y /= 2;
      `
    );
    valid(
      'arithmetic',
      '-1 + (+2) - 3 / 4 * 5 % 6 ** 2'
    );
    valid(
      'bitwise',
      '~1 & 2 | 3 ^ 4 >> 1 << 2 >>> 3'
    );
    valid(
      'comparison (but only strict equality)',
      '1 < 2 <= 3 > 4 >= 5 === 6 !== 7'
    );
    valid(
      'destructuring',
      `
      const { x, y, z } = { x: 1, y: 2, z: "foo" }
      const [a, b, c] = [1, 2, "foo"]
      `
    );
    valid(
      'spreading',
      `
      const x = { "a": 1, "b": 2 }
      const y = { ...x, "a": 3 }
      `
    );
    valid(
      'arrow functions, calls and returns',
      `
      const foo = (x) => {
        if (x === 0) return 0;
        return x + foo(x - 1);
      }
      `
    );
    valid(
      'rest parameter',
      '(x, ...rest) => rest.length'
    );
    valid(
      'template strings',
      '(x, y) => `${x} and ${y}`'
    );
    valid(
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
      `
    );
    valid(
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
      `
    );
  });
});
