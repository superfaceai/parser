import './test/validate-custom-matcher';

import { ProfileDocumentNode } from '@superfaceai/ast';

import { parseProfile } from '..';
import { Source } from '../common/source';

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

      expect(profileAst).not.toBeValidExample([
        'ComlinkPrimitiveLiteral - Wrong Structure: expected boolean, but got 1',
      ]);
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

      expect(profileAst).not.toBeValidExample([
        'ComlinkPrimitiveLiteral - Wrong Structure: expected NOTFOUND or BADREQUEST, but got "NOTFOUNDFOUND"',
      ]);
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

      expect(profileAst).not.toBeValidExample([
        'ComlinkPrimitiveLiteral - Wrong Structure: expected boolean | number, but got "string"',
        'ComlinkPrimitiveLiteral - Wrong Structure: expected number, but got "string"',
      ]);
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

      expect(profileAst).not.toBeValidExample([
        'ComlinkPrimitiveLiteral - Wrong Structure: expected [boolean | number], but got "string"',
      ]);
    });
  });
});
