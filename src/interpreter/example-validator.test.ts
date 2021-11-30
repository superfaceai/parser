import { ProfileDocumentNode } from '@superfaceai/ast';

import { parseProfile, Source } from '..';
import { formatIssues } from '.';
import { ExamplesValidator } from './example-validator';

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
      const exampleValidator = new ExamplesValidator(profileAst);
      const result = exampleValidator.validate();

      expect(!result.pass && formatIssues(result.errors)).toEqual(
        '8:24 ComlinkPrimitiveLiteral - Wrong Structure: expected boolean, but got "1"'
      );
    });

    it('enum', () => {
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
      const exampleValidator = new ExamplesValidator(profileAst);
      const result = exampleValidator.validate();

      expect(!result.pass && formatIssues(result.errors)).toEqual(
        '11:24 ComlinkPrimitiveLiteral - Wrong Structure: expected NOTFOUND or BADREQUEST, but got "NOTFOUNDFOUND"'
      );
    });

    it('list', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
            result [boolean | number]
            error [{code number}]

            example success {
              result ["string", "string"]
            }

            example fail {
              error [
                {
                  code = 'string'
                }
              ]
            }
        }`
      );
      const exampleValidator = new ExamplesValidator(profileAst);
      const result = exampleValidator.validate();

      expect(!result.pass && formatIssues(result.errors)).toEqual(
        '9:23 ComlinkPrimitiveLiteral - Wrong Structure: expected UnionStructure, but got "string"\n15:26 ComlinkPrimitiveLiteral - Wrong Structure: expected number, but got "string"'
      );
    });

    it('object', () => {
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
      const exampleValidator = new ExamplesValidator(profileAst);
      const result = exampleValidator.validate();

      expect(!result.pass && formatIssues(result.errors)).toEqual(
        '13:28 ComlinkPrimitiveLiteral - Wrong Structure: expected ListStructure, but got "string"'
      );
    });
  });
});
