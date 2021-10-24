import { MapASTNode, ProfileDocumentNode } from '@superfaceai/ast';
import { parseMap, parseProfile, Source } from '..';

import { ValidationIssue } from './issue';
import { ProfileOutput } from './profile-output';
import { formatIssues, getProfileOutput, validateMap } from './utils';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidMap(
        profileOutput: ProfileOutput,
        warning: string,
        error?: string
      ): R;
    }
  }
}

expect.extend({
  toBeValidMap(
    map: MapASTNode,
    profileOutput: ProfileOutput,
    warning: string,
    error?: string
  ) {
    const result = validateMap(profileOutput, map);

    let message = '';
    let pass = true;
    let errors: ValidationIssue[] = [];
    let warnings: ValidationIssue[] = [];

    if (!result.pass) {
      errors = result.errors;
    }
    if (result.warnings && result.warnings.length > 0) {
      warnings = result.warnings;
    }

    if (this.isNot) {
      pass = false;

      if (!error) {
        pass = !pass;
        message = 'expected to fail';
      } else {
        const err = formatIssues(errors);
        const warn = formatIssues(warnings);

        if (!err.includes(error)) {
          pass = !pass;
          message = `expected to find error "${error}" in "${err}"`;
          if (warning !== '' && !warn.includes(warning)) {
            message += `, expected to find warning "${warning}" in "${warn}"`;
          }
        } else if (warning !== '' && !warn.includes(warning)) {
          pass = !pass;
          message = `expected to find warning "${warning}" in "${warn}"`;
        }
      }
    } else {
      const warn = formatIssues(warnings);
      const err = formatIssues(errors);
      if (errors.length > 0) {
        pass = !pass;
        message = `expected to pass, errors: ${err}, warnings: ${warn}`;
      } else if (warning && warning !== '' && !warn.includes(warning)) {
        pass = !pass;
        message = `expected to find warning "${warning}" in "${warn}"`;
      }
    }

    return {
      pass,
      message: (): string => message,
    };
  },
});

function valid(
  profile: ProfileDocumentNode,
  maps: MapASTNode[],
  ...warnings: string[]
): void {
  const profileOutput = getProfileOutput(profile);

  it('then validation will pass', () => {
    maps.forEach((map, index) => {
      expect(map).toBeValidMap(profileOutput, warnings[index]);
    });
  });
}

function invalid(
  profile: ProfileDocumentNode,
  maps: MapASTNode[],
  ...results: string[]
): void {
  const profileOutput = getProfileOutput(profile);

  it('then validation will fail', () => {
    let i = 0;
    maps.forEach(map => {
      expect(map).not.toBeValidMap(profileOutput, results[i + 1], results[i]);
      i += 2;
    });
  });
}

const parseMapFromSource = (source: string): MapASTNode =>
  parseMap(
    new Source(
      `
      profile = "test@1.0"
      provider = "test"
      ` + source
    )
  );

const parseProfileFromSource = (source: string): ProfileDocumentNode =>
  parseProfile(
    new Source(
      `
      name = "test"
      version = "1.0.0"
      ` + source
    )
  );

describe('MapValidator', () => {
  describe('result & error', () => {
    describe('result is PrimitiveTypeName', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          result enum {
            NOTFOUND
            BADREQUEST
          }
        }`
      );
      const mapAst1 = parseMapFromSource(
        `map Test {
          map result 'NOTFOUND'
          map result 'BADREQUEST'
        }`
      );
      const mapAst2 = parseMapFromSource(
        `map Test {
          map result 'wrong'
        }`
      );

      valid(profileAst, [mapAst1]);
      invalid(
        profileAst,
        [mapAst2],
        'PrimitiveLiteral - Wrong Structure: expected NOTFOUND or BADREQUEST, but got "wrong"',
        ''
      );
    });

    describe('error is PrimitiveTypeName', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          error enum {
            NOTFOUND
            BADREQUEST
          }
        }`
      );

      const mapAst1 = parseMapFromSource(
        `map Test {
          map error 'NOTFOUND'
          map error 'BADREQUEST'
        }`
      );

      const mapAst2 = parseMapFromSource(
        `map Test {
          map error 'wrong'
        }`
      );

      valid(profileAst, [mapAst1]);
      invalid(
        profileAst,
        [mapAst2],
        'PrimitiveLiteral - Wrong Structure: expected NOTFOUND or BADREQUEST, but got "wrong"',
        ''
      );
    });

    describe('result is an object', () => {
      describe('possibly null field f1', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1 string
            }
          }`
        );

        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result {}
            map result { f1 = null }
          }`
        );

        const mapAst3 = parseMapFromSource(
          `map Test {
            map result {
              f1 = {
                inner = 2
              }
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, but got f1, f2\nObjectLiteral - Wrong Object Structure: expected f1, but got f1, f2\nObjectLiteral - Wrong Object Structure: expected f1, but got f2'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Wrong Structure: expected string, but got "ObjectLiteral"',
          ''
        );
      });

      describe('possibly null fields: f1, f2', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1 string
              f2 number
            }
          }`
        );

        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result {
            }
            map result {
              f1 = null
            }
            map result {
              f2 = null
            }
            map result {
              f1 = null
              f2 = null
            }
            map result {
              f1 = "some string"
            }
            map result {
              f2 = 2
            }
            map result {
              f1 = "some string"
              f2 = 2
            }
            map result {
              f1 = "some string"
              f3 = 3
            }
            map result {
              f3 = 3
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map result {
              f1 = ["some", "key"]
              f2 = 2
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          '1:16 ArrayLiteralExpression - Wrong Structure: expected string, but got "["some", "key"]"',
          ''
        );
      });

      describe('non null field f1', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1 string!
            }
          }`
        );

        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result {
            }
            map result {
              f1 = "some string"
            }
            map result {
              f1 = "some string"
              f3 = 3
            }
            map result {
              f3 = 3
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map result {
              f1 = null
            }
            map result {
              f1 = ["some", "key"]
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, but got f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          '1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected string, but got "["some", "key"]"\n1:16 ArrayLiteralExpression - Wrong Structure: expected string, but got "["some", "key"]"',
          ''
        );
      });

      describe('fields: f1, f2, where f2 is non null', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1 string
              f2 number!
            }
          }`
        );

        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result {
            }
            map result {
              f1 = null
            }
            map result {
              f1 = "some string"
            }
            map result {
              f2 = 2
            }
            map result {
              f1 = null
              f2 = 2
            }
            map result {
              f1 = "some string"
              f2 = 2
            }
            map result {
              f1 = "some string"
              f2 = 2
              f3 = 3
            }
            map result {
              f2 = 2
              f3 = 3
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map result {
              f1 = "some string"
              f2 = null
            }
            map result {
              f2 = null
              f3 = 3
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'JessieExpression - Wrong Structure: expected number, but got "null"\n1:5 NullKeyword - Wrong Structure: expected number, but got "null"\nJessieExpression - Wrong Structure: expected number, but got "null"\n1:5 NullKeyword - Wrong Structure: expected number, but got "null"',
          ''
        );
      });

      describe('non null fields: f1, f2', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1 string!
              f2 number!
            }
          }`
        );

        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result {
            }
            map result {
              f1 = "some string"
            }
            map result {
              f2 = 2
            }
            map result {
              f1 = "some string"
              f2 = 2
            }
            map result {
              f1 = "some string"
              f3 = 3
            }
            map result {
              f1 = "some string"
              f2 = 2
              f3 = 3
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map result {
              f1 = null
            }
            map result {
              f1 = null
              f2 = null
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'JessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected number, but got "null"\n1:5 NullKeyword - Wrong Structure: expected number, but got "null"',
          ''
        );
      });

      describe('one required field: f1', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1! string!
            }
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result {
              f1 = "some string"
            }
            map result {
              f1 = "some string"
              f3 = 3
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map result {
            }
            map result {
              f1 = null
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, but got f1, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"',
          ''
        );
      });

      describe('one required and one not required field: f1, f2', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1! string!
              f2 boolean!
            }
          }`
        );

        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result {
              f1 = "some string"
            }
            map result {
              f1 = "some string"
              f2 = true
            }
            map result {
              f1 = "some string"
              f3 = 3
            }
            map result {
              f1 = "some string"
              f2 = false
              f3 = 3
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map result {
            }
            map result {
              f1 = null
            }
            map result {
              f2 = null
            }
            map result {
              f1 = null
              f2 = null
            }
            map result {
              f2 = true
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field',
          ''
        );
      });

      describe('required fields: f1, f2', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1! string!
              f2! boolean!
            }
          }`
        );

        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result {
              f1 = "some string"
              f2 = true
            }
            map result {
              f1 = "some string"
              f2 = true
              f3 = 3
            }
          }`
        );

        const mapAst3 = parseMapFromSource(
          `map Test {
            map result {
            }
            map result {
              f1 = null
            }
            map result {
              f2 = null
            }
            map result {
              f1 = null
              f2 = null
            }
            map result {
              f1 = "some string"
            }
            map result {
              f2 = true
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Missing required field\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field\nObjectLiteral - Missing required field',
          ''
        );
      });

      describe('non null object with two required fields f1, f2', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1! string!
              f2! number!
            }!
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            map result {
              f1 = "some string"
              f2 = 2
            }
            map result {
              f1 = "some string"
              f2 = 2
              f3 = 3
            }
          }`
        );
        const mapAst2 = parseMapFromSource(`map Test {}`);
        const mapAst3 = parseMapFromSource(
          `map Test {
            map result {
            }
            map result {
              f1 = null
            }
            map result {
              f1 = "some string"
            }
            map result null
          }`
        );

        valid(
          profileAst,
          [mapAst1],
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst2, mapAst3],
          'MapDefinition - Result not defined',
          '',
          'ObjectLiteral - Missing required field\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nObjectLiteral - Missing required field\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected ObjectStructure, but got "null"\n1:5 NullKeyword - Wrong Structure: expected ObjectStructure, but got "null"',
          ''
        );
      });

      describe('that uses dot.notation for fields', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1 {
                f2 {
                  inner number
                }
              }
              f2 number
            }    
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            map result {
              f1.f2.inner = 1
              f2 = 2
            }
            map result {
              f1 = {
                f2.inner = 1
              }
              f2 = 2
            }
            map result {
              f1 = {
                f2 = {
                  inner = 1
                }
              }
              f2 = 2
            }
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result {
              f1.f2.inner = 1
              f2.f1 = 2
            }
            map result {
              f1.f2.inner = 1
              f2.f1 = 2
            }
            map result {
              f1.f2.inner = 1
              f2 = {
                f1 = 2
              }
            }
          }`
        );

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          'ObjectLiteral - Wrong Structure: expected number, but got "ObjectLiteral"\nObjectLiteral - Wrong Structure: expected number, but got "ObjectLiteral"\nObjectLiteral - Wrong Structure: expected number, but got "ObjectLiteral"',
          ''
        );
      });
    });

    describe('error is an object', () => {
      describe('possibly null field f1', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error {
              f1 string
            }    
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error {
            }
            map error {
              f1 = null
            }
            map error {
              f1 = null
              f2 = null
            }
            map error {
              f1 = "some string"
              f2 = 2
            }
            map error {
              f2 = 2
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error {
              f1 = {
                inner = 2
              }
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, but got f1, f2\nObjectLiteral - Wrong Object Structure: expected f1, but got f1, f2\nObjectLiteral - Wrong Object Structure: expected f1, but got f2'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Wrong Structure: expected string, but got "ObjectLiteral"',
          ''
        );
      });

      describe('possibly null fields: f1, f2', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error {
              f1 string
              f2 number
            }    
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error {
            }
            map error {
              f1 = null
            }
            map error {
              f2 = null
            }
            map error {
              f1 = null
              f2 = null
            }
            map error {
              f1 = "some string"
            }
            map error {
              f2 = 2
            }
            map error {
              f1 = "some string"
              f2 = 2
            }
            map error {
              f1 = "some string"
              f3 = 3
            }
            map error {
              f3 = 3
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error {
              f1 = ["some", "key"]
              f2 = 2
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          '1:16 ArrayLiteralExpression - Wrong Structure: expected string, but got "["some", "key"]"',
          ''
        );
      });

      describe('non null field f1', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error {
              f1 string!
            }    
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error {
            }
            map error {
              f1 = "some string"
            }
            map error {
              f1 = "some string"
              f3 = 3
            }
            map error {
              f3 = 3
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error {
              f1 = null
            }
            map error {
              f1 = ["some", "key"]
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, but got f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          '1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected string, but got "["some", "key"]"\n1:16 ArrayLiteralExpression - Wrong Structure: expected string, but got "["some", "key"]"',
          ''
        );
      });

      describe('fields: f1, f2, where f2 is non null', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error {
              f1 string
              f2 number!
            }    
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error {
            }
            map error {
              f1 = null
            }
            map error {
              f1 = "some string"
            }
            map error {
              f2 = 2
            }
            map error {
              f1 = null
              f2 = 2
            }
            map error {
              f1 = "some string"
              f2 = 2
            }
            map error {
              f1 = "some string"
              f2 = 2
              f3 = 3
            }
            map error {
              f2 = 2
              f3 = 3
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error {
              f1 = "some string"
              f2 = null
            }
            map error {
              f2 = null
              f3 = 3
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'JessieExpression - Wrong Structure: expected number, but got "null"\n1:5 NullKeyword - Wrong Structure: expected number, but got "null"\nJessieExpression - Wrong Structure: expected number, but got "null"\n1:5 NullKeyword - Wrong Structure: expected number, but got "null"',
          ''
        );
      });

      describe('non null fields: f1, f2', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error {
              f1 string!
              f2 number!
            }    
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error {
            }
            map error {
              f1 = "some string"
            }
            map error {
              f2 = 2
            }
            map error {
              f1 = "some string"
              f2 = 2
            }
            map error {
              f1 = "some string"
              f3 = 3
            }
            map error {
              f1 = "some string"
              f2 = 2
              f3 = 3
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error {
              f1 = null
            }
            map error {
              f1 = null
              f2 = null
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'JessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected number, but got "null"\n1:5 NullKeyword - Wrong Structure: expected number, but got "null"',
          ''
        );
      });

      describe('one required field: f1', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error {
              f1! string!
            }    
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error {
              f1 = "some string"
            }
            map error {
              f1 = "some string"
              f3 = 3
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error {
            }
            map error {
              f1 = null
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, but got f1, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"',
          ''
        );
      });

      describe('one required and one not required field: f1, f2', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error {
              f1! string!
              f2 boolean!
            }        
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error {
              f1 = "some string"
            }
            map error {
              f1 = "some string"
              f2 = true
            }
            map error {
              f1 = "some string"
              f3 = 3
            }
            map error {
              f1 = "some string"
              f2 = false
              f3 = 3
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error {
            }
            map error {
              f1 = null
            }
            map error {
              f2 = null
            }
            map error {
              f1 = null
              f2 = null
            }
            map error {
              f2 = true
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field',
          ''
        );
      });

      describe('required fields: f1, f2', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error {
              f1! string!
              f2! boolean!
            }
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error {
              f1 = "some string"
              f2 = true
            }
            map error {
              f1 = "some string"
              f2 = true
              f3 = 3
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error {
            }
            map error {
              f1 = null
            }
            map error {
              f2 = null
            }
            map error {
              f1 = null
              f2 = null
            }
            map error {
              f1 = "some string"
            }
            map error {
              f2 = true
            }
          }`
        );

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Missing required field\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field\nObjectLiteral - Missing required field',
          ''
        );
      });

      describe('non null object with two required fields f1, f2', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error {
              f1! string!
              f2! number!
            }!    
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            map error {
              f1 = "some string"
              f2 = 2
            }
            map error {
              f1 = "some string"
              f2 = 2
              f3 = 3
            }
          }`
        );
        const mapAst2 = parseMapFromSource(`map Test {}`);
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error {
            }
            map error {
              f1 = null
            }
            map error {
              f1 = "some string"
            }
            map error null
          }`
        );

        valid(
          profileAst,
          [mapAst1],
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst2, mapAst3],
          'MapDefinition - Error not defined',
          '',
          'ObjectLiteral - Missing required field\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nObjectLiteral - Missing required field\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected ObjectStructure, but got "null"\n1:5 NullKeyword - Wrong Structure: expected ObjectStructure, but got "null"',
          ''
        );
      });
    });

    describe('result is a list', () => {
      describe('primitive type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result [boolean]    
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result [null]
            map result [true]
            map result [true, false]
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map result [2]
            map result [{}]
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '2:3 FirstLiteralToken - Wrong Structure: expected boolean, but got "2"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[{}]"\n2:4 ObjectLiteralExpression - Wrong Structure: expected boolean, but got "{}"',
          ''
        );
      });

      describe('primitive or object type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result [boolean | {}]    
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result [true]
            map result [null]
            map result [true, false]
            map result [{}, {}]
            map result [true, {}]
            map result [true, false, true, false, {}, true, {}, true, {}]
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map result [2]
            map result [[true]]
            map result [true, 2, {}]
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '1:4 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"',
          ''
        );
      });

      describe('non null primitive type or possibly null object type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result [boolean! | {}]
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result []
            map result [null]
            map result [true]
            map result [true, {}]
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map result [true, 2]
            map result [true, 2, {}]
            map result [[true]]
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '1:10 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"',
          ''
        );
      });

      describe('non null primitive type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result [boolean!]    
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result [true]
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map result [null]
            map result [{}]
            map result [true, {}]
            map result [true, 2]
            map result [[true]]
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '2:6 NullKeyword - Wrong Structure: expected boolean, but got "null"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[{}]"\n2:4 ObjectLiteralExpression - Wrong Structure: expected boolean, but got "{}"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, {}]"\n8:10 ObjectLiteralExpression - Wrong Structure: expected boolean, but got "{}"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\n8:9 FirstLiteralToken - Wrong Structure: expected boolean, but got "2"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n2:8 ArrayLiteralExpression - Wrong Structure: expected boolean, but got "[true]"',
          ''
        );
      });

      describe('non null primitive or object type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result [boolean! | {}!]    
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result [true]
            map result []
            map result [true, {}]
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map result [null]
            map result [undefined]
            map result [true, 2]
            map result [true, 2, {}]
            map result [[true]]
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '1:7 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[null]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[undefined]"\n1:12 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[undefined]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\n1:10 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"',
          ''
        );
      });

      describe('non null list with primitive or object type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result [boolean | {}]!                
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            map result [null]
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result [true, {}]
          }`
        );
        const mapAst3 = parseMapFromSource(`map Test {}`);
        const mapAst4 = parseMapFromSource(
          `map Test {
            map result [true, 2]
            map result [true, 2, {}]
            map result [[true]]
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3, mapAst4],
          'MapDefinition - Result not defined',
          '',
          'ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"',
          ''
        );
      });
    });

    describe('error is a list', () => {
      describe('primitive type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error [boolean]
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error [null]
            map error [true]
            map error [true, false]
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error [2]
            map error [{}]
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '2:3 FirstLiteralToken - Wrong Structure: expected boolean, but got "2"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[{}]"\n2:4 ObjectLiteralExpression - Wrong Structure: expected boolean, but got "{}"',
          ''
        );
      });

      describe('primitive or object type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error [boolean | {}]
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error [true]
            map error [null]
            map error [true, false]
            map error [{}, {}]
            map error [true, {}]
            map error [true, false, true, false, {}, true, {}, true, {}]
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error [2]
            map error [[true]]
            map error [true, 2, {}]
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '1:4 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"',
          ''
        );
      });

      describe('non null primitive type or possibly null object type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error [boolean! | {}]
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error []
            map error [null]
            map error [true]
            map error [true, {}]
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error [true, 2]
            map error [true, 2, {}]
            map error [[true]]
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '1:10 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"',
          ''
        );
      });

      describe('non null primitive type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error [boolean!]
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error [true]
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error [null]
            map error [{}]
            map error [true, {}]
            map error [true, 2]
            map error [[true]]
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '2:6 NullKeyword - Wrong Structure: expected boolean, but got "null"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[{}]"\n2:4 ObjectLiteralExpression - Wrong Structure: expected boolean, but got "{}"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, {}]"\n8:10 ObjectLiteralExpression - Wrong Structure: expected boolean, but got "{}"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\n8:9 FirstLiteralToken - Wrong Structure: expected boolean, but got "2"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n2:8 ArrayLiteralExpression - Wrong Structure: expected boolean, but got "[true]"',
          ''
        );
      });

      describe('non null primitive or object type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error [boolean! | {}!]
          }`
        );
        const mapAst1 = parseMapFromSource(`map Test {}`);
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error [true]
            map error []
            map error [true, {}]
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error [null]
            map error [undefined]
            map error [true, 2]
            map error [true, 2, {}]
            map error [[true]]
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '1:7 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[null]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[undefined]"\n1:12 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[undefined]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\n1:10 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"',
          ''
        );
      });

      describe('non null list with primitive or object type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error [boolean | {}]!
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            map error [null]
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error [true, {}]
          }`
        );
        const mapAst3 = parseMapFromSource(`map Test {}`);
        const mapAst4 = parseMapFromSource(
          `map Test {
            map error [true, 2]
            map error [true, 2, {}]
            map error [[true]]
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3, mapAst4],
          'MapDefinition - Error not defined',
          '',
          'JessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\n1:10 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\n6:23 JessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n7:23 JessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"',
          ''
        );
      });
    });

    describe('result is a jessie script', () => {
      describe('object', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1 string
              f2 boolean
            }
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            map result {
            f1: 'some string',
            f2: true
          }
            map result body.map(function (val) { return val.toUpperCase(); })
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result ['some string', true]
          }`
        );

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          '1:22 ArrayLiteralExpression - Wrong Structure: expected ObjectStructure, but got "[\'some string\', true]"',
          ''
        );
      });

      describe('array', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result [string | boolean]
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            map result ['some string', true]
            map result Array('some string', true)
            a = ["hello", "world"]
            map result [...a.map(val => val.toUpperCase())]
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            a = ["hello", "world"]
            map result {...a.map(val => val.toUpperCase())}
            map result {
              f1: 'some string',
              f2: true
            }
          }`
        );

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          'JessieExpression - Wrong Structure: expected ListStructure, but got "{...a.map(val => val.toUpperCase())}"\n1:37 ObjectLiteralExpression - Wrong Structure: expected ListStructure, but got "{...a.map(val => val.toUpperCase())}"\n7:24 JessieExpression - Wrong Structure: expected ListStructure, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"\n1:72 ObjectLiteralExpression - Wrong Structure: expected ListStructure, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"',
          ''
        );
      });

      describe('primitive type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result string
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            map result 'string' + true'
            map result 1+"true"
            map result "some " + "string"
            map result String(24)
            map result ['some ', 'string'].join('')
            map result \`some \${var}\`
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result ['some string', true]
            map result {
            f1: 'some string',
            f2: true
          }
            map result true
            map result false
            map result 2+25
          }`
        );

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          '1:22 ArrayLiteralExpression - Wrong Structure: expected string, but got "[\'some string\', true]"\nJessieExpression - Wrong Structure: expected string, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"\n1:34 ObjectLiteralExpression - Wrong Structure: expected string, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"\nJessieExpression - Wrong Structure: expected string, but got "true"\n1:5 TrueKeyword - Wrong Structure: expected string, but got "true"\nJessieExpression - Wrong Structure: expected string, but got "false"\n1:6 FalseKeyword - Wrong Structure: expected string, but got "false"\nJessieExpression - Wrong Structure: expected string, but got "2+25"',
          ''
        );
      });
    });

    describe('error is a jessie script', () => {
      describe('object', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error {
              f1 string
              f2 boolean
            }
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            map error {
            f1: 'some string',
            f2: true
          }
            map error body.map(function (val) { return val.toUpperCase(); })
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error ['some string', true]
          }`
        );

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          '1:22 ArrayLiteralExpression - Wrong Structure: expected ObjectStructure, but got "[\'some string\', true]"',
          ''
        );
      });

      describe('array', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error [string | boolean]
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            map error ['some string', true]
            map error Array('some string', true)
            a = ["hello", "world"]
            map error [...a.map(val => val.toUpperCase())]
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            a = ["hello", "world"]
            map error {...a.map(val => val.toUpperCase())}
            map error {
              f1: 'some string',
              f2: true
            }
          }`
        );

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          'JessieExpression - Wrong Structure: expected ListStructure, but got "{...a.map(val => val.toUpperCase())}"\n1:37 ObjectLiteralExpression - Wrong Structure: expected ListStructure, but got "{...a.map(val => val.toUpperCase())}"\nJessieExpression - Wrong Structure: expected ListStructure, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"\n1:34 ObjectLiteralExpression - Wrong Structure: expected ListStructure, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"',
          ''
        );
      });

      describe('primitive type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error string
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            map error 'string' + true'
            map error 1 + "true"
            map error \"some \" + \"string\"
            map error String(24)
            map error ['some ', 'string'].join('')
            map error \`some \$\{var\}\`
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error ['some string', true]
            map error {
            f1: 'some string',
            f2: true
          }
            map error true
            map error false
            map error 2+25
          }`
        );

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          '1:22 ArrayLiteralExpression - Wrong Structure: expected string, but got "[\'some string\', true]"\nJessieExpression - Wrong Structure: expected string, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"\n1:34 ObjectLiteralExpression - Wrong Structure: expected string, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"\nJessieExpression - Wrong Structure: expected string, but got "true"\n1:5 TrueKeyword - Wrong Structure: expected string, but got "true"\nJessieExpression - Wrong Structure: expected string, but got "false"\n1:6 FalseKeyword - Wrong Structure: expected string, but got "false"\nJessieExpression - Wrong Structure: expected string, but got "2+25"',
          ''
        );
      });
    });

    describe('result is variable', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          result string
        }`
      );

      describe('referenced in outcome', () => {
        const mapAst1 = parseMapFromSource(
          `map Test {
            a.c = "string"
            map result a.c
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            a.c = "string"
            map result a
          }`
        );

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          'JessieExpression - Wrong Variable Structure: variable a expected string, but got ObjectLiteral',
          ''
        );
      });

      describe('reassigned (object)', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1 string
              f2 boolean
            }
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            foo = "string"
            foo.f1 = "string"
            foo.f2 = false
            map result foo
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            foo.f1 = "string"
            foo.f2 = false
            foo = "string"
            map result foo
          }`
        );

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          'JessieExpression - Wrong Variable Structure: variable foo expected ObjectStructure, but got string',
          ''
        );
      });

      describe('reassigned (string)', () => {
        const mapAst1 = parseMapFromSource(
          `map Test {
            a = false
            a.b = "some string"
            map result a.b
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            a.b = [1, 2, 3]
            a.b = "some string"
            map result a.b
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            a.b = "some string"
            a = false
            map result a
          }`
        );
        const mapAst4 = parseMapFromSource(
          `map Test {
            a.b = "some string"
            a.b = false
            map result a.b
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3, mapAst4],
          'JessieExpression - Wrong Variable Structure: variable a expected string, but got false',
          '',
          'JessieExpression - Wrong Variable Structure: variable a.b expected string, but got false',
          ''
        );
      });

      describe('using variable with string key', () => {
        const mapAst1 = parseMapFromSource(
          `map Test {
            foo.bar.a = "some string"
            map result "foo.bar".a
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            foo.bar.a = "some string"
            map result "foo.bar".a
            foo.bar.a = "some string"
            map result foo["bar.a"]
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            foo.bar.a = false
            map result "foo.bar".a
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          'JessieExpression - Wrong Variable Structure: variable foo.bar.a expected string, but got false',
          ''
        );
      });

      describe('wrong structure', () => {
        const mapAst1 = parseMapFromSource(
          `map Test {
            a.b = false
            map result a.b
          }`
        );

        invalid(
          profileAst,
          [mapAst1],
          'JessieExpression - Wrong Variable Structure: variable a.b expected string, but got false',
          ''
        );
      });

      describe('in different scopes', () => {
        const mapAst1 = parseMapFromSource(
          `map Test {
            a.c = false
            b = "some string"
            http GET "http://example.com/" {
              response {
                a.c = "some string"
          
                c = "some string"
          
                map result a.c
          
                map result b
              }
            }
            map result a.c
          }`
        );

        invalid(
          profileAst,
          [mapAst1],
          'JessieExpression - Wrong Variable Structure: variable a.c expected string, but got false',
          ''
        );
      });
    });

    describe('result is conditioned', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          result {
            f1 {
              inner string
            }
          }
        }`
      );
      const mapAst = parseMapFromSource(
        `map Test {
          map result if (cond) {
            f1 = {
              inner = {}
            }
          }
        }`
      );

      valid(
        profileAst,
        [mapAst],
        'ObjectLiteral - Wrong Structure: expected string, but got "ObjectLiteral"'
      );
    });

    describe('error is conditioned', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          error {
            f1 {
              inner string
            }
          }
        }`
      );
      const mapAst = parseMapFromSource(
        `map Test {
          map error if (cond) {
            f1 = {
              inner = {}
            }
          }
          map error if (cond) "some string"
        }`
      );

      valid(
        profileAst,
        [mapAst],
        'ObjectLiteral - Wrong Structure: expected string, but got "ObjectLiteral"\nPrimitiveLiteral - Wrong Structure: expected ObjectStructure, but got "some string"'
      );
    });

    describe('map is using http call', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          input {
            to string
            from
          }
          result {
            from string
            text string
          }
        }`
      );
      const mapAst1 = parseMapFromSource(
        `map Test {
          some.variable = "string"
          http POST "http://example.com/{some.variable}/{input.from}" {
            response 200 {
              map result {
                from = "some string"
                text = "some string"
              }
            }
          }
        }`
      );
      const mapAst2 = parseMapFromSource(
        `map Test {
          http POST "http://www.example.com/" {
            response 200 {
              map result {
                from = {}
                text = "some string"
              }
            }
          }
        }`
      );

      valid(
        profileAst,
        [mapAst1],
        'HttpCallStatement - Wrong Structure: expected string, but got "ScalarStructure"'
      );
      invalid(
        profileAst,
        [mapAst2],
        'ObjectLiteralExpression - Wrong Structure: expected string, but got "{}"',
        ''
      );
    });

    describe('map is using inline call', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          result {
            from string
            text string
          }
        }`
      );
      const mapAst1 = parseMapFromSource(
        `operation Foo {
          return "some string"
        }
        
        operation Bar {
          return "some string"
        }
        
        map Test {
          map result {
            from = call Foo()
            text = call Bar()
          }
        }`
      );
      const mapAst2 = parseMapFromSource(
        `operation Foo {
          return "some string"
        }
        
        operation Bar {
          return {
          }
        }
        
        map Test {
          map result {
            from = call Foo()
            text = call Bar()
          }
        }`
      );

      valid(profileAst, [mapAst1, mapAst2]);
    });
  });

  describe('input', () => {
    const profileAst = parseProfileFromSource(
      `usecase Test {
        input {
          person {
            from string
            to string
          }
          to string
          from string
          text string
        }
      }`
    );

    describe('input referenced in HttpCallStatement', () => {
      const mapAst1 = parseMapFromSource(
        `map Test {
          http POST "http://www.example.com/" {
            request {
              body {
                to = input.to
                sms.from = input.from
                sms.text = input.text
                to.person = input.person.to
              }
            }
        
            response 200 {
              map result "OK"
            }
          }
        }`
      );
      const mapAst2 = parseMapFromSource(
        `map Test {
          http POST "http://www.example.com/" {
            request {
              body {
                to = input.wrong
                sms.from = input.from
                sms.text = input.text
                to.person = input.person.wrong
              }
            }
        
            response 200 {
              map result "OK"
            }
          }
        }`
      );

      valid(profileAst, [mapAst1]);
      invalid(
        profileAst,
        [mapAst2],
        'JessieExpression - Wrong Input Structure: expected person, to, from, text, but got input.wrong\n1:12 PropertyAccessExpression - Wrong Input Structure: expected person, to, from, text, but got input.wrong',
        ''
      );
    });

    describe('input referenced in SetStatement', () => {
      const mapAst1 = parseMapFromSource(
        `map Test {
          set {
            a = input.from
            b = input.person.from
          }
        }`
      );
      const mapAst2 = parseMapFromSource(
        `map Test {
          set {
            a = input.wrong
            b = input.person.wrong
          }
        }`
      );

      valid(profileAst, [mapAst1]);
      invalid(
        profileAst,
        [mapAst2],
        '1:12 PropertyAccessExpression - Wrong Input Structure: expected person, to, from, text, but got input.wrong',
        ''
      );
    });

    describe('input referenced in ConditionAtomNode', () => {
      const mapAst1 = parseMapFromSource(
        `map Test {
          a = 25 + 10
          map result input.person.from
        }`
      );
      const mapAst2 = parseMapFromSource(
        `map Test {
          a = 25 + 10
          map result input.person.wrong
        }`
      );

      valid(profileAst, [mapAst1]);
      invalid(
        profileAst,
        [mapAst2],
        'JessieExpression - Wrong Input Structure: expected person, to, from, text, but got input.person.wrong\n1:19 PropertyAccessExpression - Wrong Input Structure: expected person, to, from, text, but got input.person.wrong',
        ''
      );
    });

    describe('input referenced in arguments of CallStatement', () => {
      const mapAst1 = parseMapFromSource(
        `operation Foo {}
        
        map Test {
          call Foo(from.person = input.person.from, to.person = input.person.to, message = input.text) {
          }
        }`
      );
      const mapAst2 = parseMapFromSource(
        `operation Foo {}
        
        map Test {
          call Foo(from.person = input.person.from, to.person = input.person.wrong, message = input.so.wrong, super.wrong = input.person.something.really.wrong.do.not.do.this) {
          }
        }`
      );

      valid(profileAst, [mapAst1]);
      invalid(
        profileAst,
        [mapAst2],
        'JessieExpression - Wrong Input Structure: expected person, to, from, text, but got input.person.wrong\n1:19 PropertyAccessExpression - Wrong Input Structure: expected person, to, from, text, but got input.person.wrong',
        ''
      );
    });
  });

  describe('usecase-map compatibility', () => {
    describe('multiple maps', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          result string
        }`
      );
      const mapAst = parseMapFromSource(
        `map Test {
          map result "some string"
        }
        
        map Test2 {
          map result true
        }`
      );

      valid(profileAst, [mapAst], '', 'Extra Map');
    });

    describe('missing maps', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test1 {
          result string
        }
        usecase Test2 {
          result boolean
        }`
      );
      const mapAst = parseMapFromSource(
        `map Test1 {
          map result "some string"
        }`
      );

      invalid(profileAst, [mapAst], 'MapDocument - Map not found: Test2', '');
    });

    describe('wrong profile name', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          result string
        }`
      );
      const mapAst = parseMap(
        new Source(`profile = "wrong@1.0"
        provider = "test"
        
        map Test {
          map result "some string"
        }`)
      );

      invalid(
        profileAst,
        [mapAst],
        'MapHeader - Wrong Profile Name: expected test, but got wrong',
        ''
      );
    });

    describe('wrong scope', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          result string
        }`
      );
      const mapAst = parseMap(
        new Source(`profile = "starwars/test@1.0"
        provider = "test"
        
        map Test {
          map result "some string"
        }`)
      );

      invalid(
        profileAst,
        [mapAst],
        'MapHeader - Wrong Scope: expected no scope in profile, but got starwars',
        ''
      );
    });

    describe('wrong version', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          result string
        }`
      );
      const mapAst = parseMap(
        new Source(`profile = "test@2.0"
        provider = "test"
        
        map Test {
          map result "some string"
        }`)
      );

      invalid(
        profileAst,
        [mapAst],
        'MapHeader - Wrong Profile Version: profile is 1.0.0, but map requests 2.0',
        ''
      );
    });

    describe('profile result missing', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          error string
        }`
      );
      const mapAst = parseMapFromSource(
        `map Test {
          map result "some string"
        }`
      );

      valid(
        profileAst,
        [mapAst],
        'OutcomeStatement - Result Not Found: returning "some string", but there is no result defined in usecase'
      );
    });

    describe('profile error missing', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          result string
        }`
      );
      const mapAst = parseMapFromSource(
        `map Test {
          map error "some string"
        }`
      );

      valid(
        profileAst,
        [mapAst],
        'OutcomeStatement - Error Not Found: returning "some string", but there is no error defined in usecase'
      );
    });

    describe('profile input missing', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          error string
        }`
      );
      const mapAst = parseMapFromSource(
        `operation Foo {}
        
        map Test {
          map error if (input.something) "some string"

          output = call Foo(some.key = input.some.variable)

          map result output
        }`
      );

      invalid(
        profileAst,
        [mapAst],
        'JessieExpression - Input Not Found: input.something - there is no input defined in usecase\n1:16 PropertyAccessExpression - Input Not Found: input.something - there is no input defined in usecase\n9:40 JessieExpression - Input Not Found: input.some.variable - there is no input defined in usecase\n1:20 PropertyAccessExpression - Input Not Found: input.some.variable - there is no input defined in usecase',
        'OutcomeStatement - Result Not Found: returning "JessieExpression", but there is no result defined in usecase'
      );
    });
  });
});
