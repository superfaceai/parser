import { ProfileDocumentNode } from '@superfaceai/ast';

import { parseProfile, Source } from '..';
import { formatIssues } from '.';
import { ExampleValidator } from './example-validator';

const parseProfileFromSource = (source: string): ProfileDocumentNode =>
  parseProfile(
    new Source(
      `
      name = "profile"
      version = "1.0.0"
      ` + source
    )
  );

describe('ExampleValidator', () => {
  describe('when invalid literals are given', () => {
    it('primitive type', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
            result boolean

            example fail {
                result 1
            }
        }`
      );
      const exampleValidator = new ExampleValidator(profileAst);
      const result = exampleValidator.validate();

      expect(!result.pass && formatIssues(result.errors)).toEqual(
        '8:24 ComlinkPrimitiveLiteral - Wrong Structure: expected boolean, but got "1"'
      );
    });

    it('in enum', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
            result enum {
                NOTFOUND
                BADREQUEST
            }

            example fail {
                result "NOTFOUNDFOUND"
            }
        }`
      );
      const exampleValidator = new ExampleValidator(profileAst);
      const result = exampleValidator.validate();

      expect(!result.pass && formatIssues(result.errors)).toEqual(
        '11:24 ComlinkPrimitiveLiteral - Wrong Structure: expected NOTFOUND or BADREQUEST, but got "NOTFOUNDFOUND"'
      );
    });

    it('in list', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
            result [boolean | number]

            example fail {
                result ["string", "string"]
            }
        }`
      );
      const exampleValidator = new ExampleValidator(profileAst);
      const result = exampleValidator.validate();

      expect(!result.pass && formatIssues(result.errors)).toEqual(
        '8:25 ComlinkPrimitiveLiteral - Wrong Structure: expected UnionStructure, but got "string"'
      );
    });

    it('in object', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
              result {
                  f1 string
                  f2 [boolean | number]
              }
  
              example fail {
                  result {
                      f1 = 'string'
                      f2 = 'string'
                  }
              }
          }`
      );
      const exampleValidator = new ExampleValidator(profileAst);
      const result = exampleValidator.validate();

      expect(!result.pass && formatIssues(result.errors)).toEqual(
        '11:26 ComlinkObjectLiteral - Wrong Structure: expected ObjectStructure, but got "ComlinkObjectLiteral"'
      );
    });
  });
});
