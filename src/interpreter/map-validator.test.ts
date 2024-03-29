import {
  isMapDocumentNode,
  MapASTNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';

import { parseMap, parseProfile } from '..';
import { Source } from '../common/source';
import {
  invalidWithErrors,
  validWithWarnings,
} from './test/validate-custom-matcher';
import { formatIssues, getProfileOutput, validateMap } from './utils';

function getIssues(
  profile: ProfileDocumentNode,
  maps: MapASTNode[]
): Record<string, { errors?: string; warnings?: string }> {
  const profileOutput = getProfileOutput(profile);
  const output: Record<string, { errors?: string; warnings?: string }> = {};
  let id: string | undefined;

  for (let i = 0; i < maps.length; i += 1) {
    const map = maps[i];
    if (isMapDocumentNode(map)) {
      id = `${map.header.profile.name}-${map.header.provider}#${i}`;
    }

    const result = validateMap(profileOutput, map);
    const issues: { errors?: string; warnings?: string } = {};

    if (!result.pass) {
      issues.errors = formatIssues(result.errors);
    }

    if (result.warnings && result.warnings.length > 0) {
      issues.warnings = formatIssues(result.warnings);
    }

    if (id === undefined) {
      throw new Error('unreachable');
    }

    output[id] = issues;
  }

  return output;
}

function valid(profile: ProfileDocumentNode, maps: MapASTNode[]): void {
  it('then validation will pass', () => {
    const allIssues = getIssues(profile, maps);
    expect(allIssues).toMatchSnapshot();

    for (const issues of Object.values(allIssues)) {
      expect(issues.warnings ?? '').toBe('');
      expect(issues.errors ?? '').toBe('');
    }
  });
}

function validWarn(profile: ProfileDocumentNode, maps: MapASTNode[]): void {
  it('then validation will pass with warnings', () => {
    const allIssues = getIssues(profile, maps);
    expect(allIssues).toMatchSnapshot();

    for (const issues of Object.values(allIssues)) {
      expect(issues.warnings ?? '').not.toBe('');
      expect(issues.errors ?? '').toBe('');
    }
  });
}

function invalid(profile: ProfileDocumentNode, maps: MapASTNode[]): void {
  it('then validation will fail', () => {
    const allIssues = getIssues(profile, maps);
    expect(allIssues).toMatchSnapshot();

    for (const issues of Object.values(allIssues)) {
      expect(issues.errors ?? '').not.toBe('');
    }
  });
}

const parseMapFromSource = (source: string): MapASTNode =>
  parseMap(
    new Source(
      `
      profile = "profile@1.0"
      provider = "provider"
      ` + source
    )
  );

const parseProfileFromSource = (source: string): ProfileDocumentNode =>
  parseProfile(
    new Source(
      `
      name = "profile"
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
      invalid(profileAst, [mapAst2]);
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
      invalid(profileAst, [mapAst2]);
    });

    describe('result is an object', () => {
      describe('empty object', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {}    
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            map result {}
          }`
        );

        const mapAst2 = parseMapFromSource(
          `map Test {
            map result {
              f2 = "what"
            }
          }`
        );

        validWithWarnings(
          profileAst,
          [mapAst1, mapAst2],
          [''],
          [
            'ObjectLiteral - Wrong Object Structure: expected {}, but got {f2: "what"}',
          ]
        );
      });

      describe('extra field', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1 string
            }    
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            map result {
              f2 = "what"
            }
          }`
        );

        validWarn(profileAst, [mapAst1]);
      });

      describe('possibly null field f1', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1 string
            }
          }`
        );

        const mapAst1 = parseMapFromSource('map Test {}');
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result {}
            map result { f1 = null }
          }`
        );

        const mapAst3 = parseMapFromSource(
          `map Test {
            map result {
              f1.inner = 2
            }
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
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

        const mapAst1 = parseMapFromSource('map Test {}');
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
            }
            map result {}
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
      });

      describe('non null field f1', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1 string!
              f3
            }
          }`
        );

        const mapAst1 = parseMapFromSource('map Test {}');
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
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

        const mapAst1 = parseMapFromSource('map Test {}');
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
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

        const mapAst1 = parseMapFromSource('map Test {}');
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
      });

      describe('one required field: f1', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1! string!
            }
          }`
        );
        const mapAst1 = parseMapFromSource('map Test {}');
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result {
              f1 = "some string"
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
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

        const mapAst1 = parseMapFromSource('map Test {}');
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
              f2 = false
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
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

        const mapAst1 = parseMapFromSource('map Test {}');
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result {
              f1 = "some string"
              f2 = true
            }
            map result {
              f1 = "some string"
              f2 = true
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
      });

      describe('required field enum f1', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1! State!
            }
          }
          model State enum {
            unknown
            ready
          }`
        );

        const mapAst1 = parseMapFromSource('map Test {}');
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result {
              f1 = "ready"
            }
            map result {
              f1 = "unknown"
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            mapState = {
              ready: "ready",
              unknown: "unknown",
            }

            map result {
              f1 = mapState["ready"]
            }
            map result {
              f1 = mapState[body.state]
            }
          }`
        );

        const mapAst4 = parseMapFromSource(
          `map Test {
            map result {}
            map result {
              f1 = null
            }
            map result {
              f2 = null
            }
            map result {
              f1 = null
            }
            map result {
              f1 = "some string"
            }
            map result {
              f1 = "some string"
            } 
          }`
        );

        valid(profileAst, [mapAst1, mapAst2, mapAst3]);
        invalid(profileAst, [mapAst4]);
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
          }`
        );
        const mapAst2 = parseMapFromSource('map Test {}');
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

        valid(profileAst, [mapAst1]);
        invalid(profileAst, [mapAst2, mapAst3]);
      });

      describe('that uses dot.notation for fields', () => {
        const mapAst1 = parseMapFromSource(
          `map Test {
            map result {
              f1.f2.inner = 1
              f2 = 2
            }

            output = {}
            output.f1.f2.inner = 1
            output.f2 = 2

            map result output
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

            output = {}
            output.f1.f2.inner = false
            output.f2 = true

            map result output
          }`
        );

        describe('with result', () => {
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

          validWithWarnings(profileAst, [mapAst1]);
          invalidWithErrors(
            profileAst,
            [mapAst2],
            [
              'ObjectLiteral - Wrong Structure: expected number, but got {f1: 2}',
              'ObjectLiteral - Wrong Structure: expected number, but got {f1: 2}',
              'PrimitiveLiteral - Wrong Structure: expected number, but got false',
              'PrimitiveLiteral - Wrong Structure: expected number, but got true',
              'JessieExpression - Wrong Variable Structure: variable output expected {f1: {f2: {inner: number}}, f2: number}, but got {f1.f2.inner: false, f2: true}',
            ],
            []
          );
        });

        describe('with strict result', () => {
          const profileAst = parseProfileFromSource(
            `usecase Test {
              result {
                f1! {
                  f2! {
                    inner! number!
                  }!
                }!
                f2! number!
              }!  
            }`
          );

          validWithWarnings(profileAst, [mapAst1]);
          invalidWithErrors(
            profileAst,
            [mapAst2],
            [
              'ObjectLiteral - Wrong Structure: expected number, but got {f1: 2}',
              'ObjectLiteral - Wrong Structure: expected number, but got {f1: 2}',
              'PrimitiveLiteral - Wrong Structure: expected number, but got false',
              'PrimitiveLiteral - Wrong Structure: expected number, but got true',
              'JessieExpression - Wrong Variable Structure: variable output expected {f1: {f2: {inner: number!}!}!, f2: number!}!, but got {f1.f2.inner: false, f2: true}',
            ],
            []
          );
        });
      });
    });

    describe('error is an object', () => {
      describe('extra field', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error {
              f1 string
            }    
          }`
        );
        const mapAst1 = parseMapFromSource(
          `map Test {
            map error {
              f2 = "what"
            }
          }`
        );

        validWarn(profileAst, [mapAst1]);
      });

      describe('possibly null field f1', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error {
              f1 string
            }    
          }`
        );
        const mapAst1 = parseMapFromSource('map Test {}');
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error {
            }
            map error {
              f1 = null
            }
            map error {
              f1 = null
            }
            map error {
              f1 = "some string"
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            map error {
              f1.inner = 2
            }
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
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
        const mapAst1 = parseMapFromSource('map Test {}');
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
      });

      describe('non null field f1', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error {
              f1 string!
            }    
          }`
        );
        const mapAst1 = parseMapFromSource('map Test {}');
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error {
            }
            map error {
              f1 = "some string"
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
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
        const mapAst1 = parseMapFromSource('map Test {}');
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
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
        const mapAst1 = parseMapFromSource('map Test {}');
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
      });

      describe('one required field: f1', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error {
              f1! string!
            }    
          }`
        );
        const mapAst1 = parseMapFromSource('map Test {}');
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error {
              f1 = "some string"
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
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
        const mapAst1 = parseMapFromSource('map Test {}');
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error {
              f1 = "some string"
            }
            map error {
              f1 = "some string"
              f2 = true
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
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
        const mapAst1 = parseMapFromSource('map Test {}');
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error {
              f1 = "some string"
              f2 = true
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
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
          }`
        );
        const mapAst2 = parseMapFromSource('map Test {}');
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

        valid(profileAst, [mapAst1]);
        invalid(profileAst, [mapAst2, mapAst3]);
      });
    });

    describe('result is a list', () => {
      describe('primitive type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result [boolean]    
          }`
        );
        const mapAst1 = parseMapFromSource('map Test {}');
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
        invalid(profileAst, [mapAst3]);
      });

      describe('primitive or object type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result [boolean | {}]    
          }`
        );
        const mapAst1 = parseMapFromSource('map Test {}');
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
        invalid(profileAst, [mapAst3]);
      });

      describe('non null primitive type or possibly null object type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result [boolean! | {}]
          }`
        );
        const mapAst1 = parseMapFromSource('map Test {}');
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
        invalid(profileAst, [mapAst3]);
      });

      describe('non null primitive type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result [boolean!]    
          }`
        );
        const mapAst1 = parseMapFromSource('map Test {}');
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
        invalid(profileAst, [mapAst3]);
      });

      describe('non null primitive or object type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result [boolean! | {}!]    
          }`
        );
        const mapAst1 = parseMapFromSource('map Test {}');
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
        invalid(profileAst, [mapAst3]);
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
        const mapAst3 = parseMapFromSource('map Test {}');
        const mapAst4 = parseMapFromSource(
          `map Test {
            map result [true, 2]
            map result [true, 2, {}]
            map result [[true]]
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3, mapAst4]);
      });
    });

    describe('error is a list', () => {
      describe('primitive type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error [boolean]
          }`
        );
        const mapAst1 = parseMapFromSource('map Test {}');
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
        invalid(profileAst, [mapAst3]);
      });

      describe('primitive or object type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error [boolean | {}]
          }`
        );
        const mapAst1 = parseMapFromSource('map Test {}');
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
        invalid(profileAst, [mapAst3]);
      });

      describe('non null primitive type or possibly null object type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error [boolean! | {}]
          }`
        );
        const mapAst1 = parseMapFromSource('map Test {}');
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
        invalid(profileAst, [mapAst3]);
      });

      describe('non null primitive type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error [boolean!]
          }`
        );
        const mapAst1 = parseMapFromSource('map Test {}');
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
        invalid(profileAst, [mapAst3]);
      });

      describe('non null primitive or object type', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            error [boolean! | {}!]
          }`
        );
        const mapAst1 = parseMapFromSource('map Test {}');
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
        invalid(profileAst, [mapAst3]);
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
        const mapAst3 = parseMapFromSource('map Test {}');
        const mapAst4 = parseMapFromSource(
          `map Test {
            map error [true, 2]
            map error [true, 2, {}]
            map error [[true]]
          }`
        );

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3, mapAst4]);
      });
    });

    describe('result is a jessie script', () => {
      describe('object', () => {
        const mapAst1 = parseMapFromSource(
          `map Test {
            map result {
              f1: 'some string',
              f2: true
            }
            map result body.map((val) => { return val.toUpperCase(); })
            map result {
              f1: any || 'some string',
              f2: some.var || other.var
            }
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result ['some string', true]
            map result {
              f1: undefined || 'some string',
              f2: some.var || other.var
            }
            map result {
              f1: null || undefined || some.var
            }
            map result {
              f1: some.var
            }
          }`
        );
        const mapAst3 = parseMapFromSource(
          `map Test {
            f1 = 'string'
            f2 = true

            res = {
              f1: f1,
              f2: f2,
            }

            map result res
          }`
        );
        const mapAst4 = parseMapFromSource(
          `map Test {
            f1 = 1
            f2 = 2

            res = {
              f1: f1,
              f2: f2,
            }

            map result res
          }`
        );

        describe('with result', () => {
          const profileAst = parseProfileFromSource(
            `usecase Test {
              result {
                f1 string
                f2 boolean
              }
            }`
          );

          validWithWarnings(profileAst, [mapAst1, mapAst3]);
          invalidWithErrors(
            profileAst,
            [mapAst2, mapAst4],
            [
              "ArrayLiteralExpression - Wrong Structure: expected {f1: string, f2: boolean}, but got ['some string', true]",
            ],
            [],
            [
              'PrimitiveLiteral - Wrong Structure: expected string, but got 1',
              'JessieExpression - Wrong Variable Structure: variable f1 expected string, but got 1',
              'PrimitiveLiteral - Wrong Structure: expected boolean, but got 2',
              'JessieExpression - Wrong Variable Structure: variable f2 expected boolean, but got 2',
              `JessieExpression - Wrong Variable Structure: variable res expected {f1: string, f2: boolean}, but got {
              f1: f1,
              f2: f2,
            }`,
            ],
            []
          );
        });

        describe('with strict result', () => {
          const profileAst = parseProfileFromSource(
            `usecase Test {
              result {
                f1! string!
                f2! boolean!
              }!
            }`
          );

          validWithWarnings(profileAst, [mapAst1, mapAst3]);
          invalidWithErrors(
            profileAst,
            [mapAst2, mapAst4],
            [
              "ArrayLiteralExpression - Wrong Structure: expected {f1: string!, f2: boolean!}, but got ['some string', true]",
              'Identifier - Wrong Structure: expected string, but got undefined',
              'NullKeyword - Wrong Structure: expected string!, but got null',
              'Identifier - Wrong Structure: expected string, but got undefined',
              'ObjectLiteralExpression - Missing required field',
              'ObjectLiteralExpression - Missing required field',
            ],
            [],
            [
              'PrimitiveLiteral - Wrong Structure: expected string, but got 1',
              'JessieExpression - Wrong Variable Structure: variable f1 expected string!, but got 1',
              'PrimitiveLiteral - Wrong Structure: expected boolean, but got 2',
              'JessieExpression - Wrong Variable Structure: variable f2 expected boolean!, but got 2',
              `JessieExpression - Wrong Variable Structure: variable res expected {f1: string!, f2: boolean!}!, but got {
              f1: f1,
              f2: f2,
            }`,
            ],
            []
          );
        });
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

        validWithWarnings(profileAst, [mapAst1]);
        invalidWithErrors(
          profileAst,
          [mapAst2],
          [
            'ObjectLiteralExpression - Wrong Structure: expected [string | boolean], but got {...a.map(val => val.toUpperCase())}',
            `ObjectLiteralExpression - Wrong Structure: expected [string | boolean], but got {
              f1: 'some string',
              f2: true
            }`,
          ],
          []
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
            map result 'string' + 'true'
            map result "some " + "string"
            map result String(24)
            map result ['some ', 'string'].join('')
            map result \`some \${jesus}\`
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result ['some string', true]
            map result {
              f1: 'some string',
              f2: true
            }
            map result 1 + "true"
            map result true
            map result false
            map result 2+25
          }`
        );

        validWithWarnings(profileAst, [mapAst1]);
        invalidWithErrors(
          profileAst,
          [mapAst2],
          [
            "ArrayLiteralExpression - Wrong Structure: expected string, but got ['some string', true]",
            `ObjectLiteralExpression - Wrong Structure: expected string, but got {
              f1: 'some string',
              f2: true
            }`,
            'FirstLiteralToken - Wrong Structure: expected string, but got 1',
            'PrimitiveLiteral - Wrong Structure: expected string, but got true',
            'PrimitiveLiteral - Wrong Structure: expected string, but got false',
            'FirstLiteralToken - Wrong Structure: expected string, but got 2',
            'FirstLiteralToken - Wrong Structure: expected string, but got 25',
          ],
          []
        );
      });
    });

    describe('error is a jessie script', () => {
      describe('object', () => {
        const mapAst1 = parseMapFromSource(
          `map Test {
            map error {
              f1: 'some string',
              f2: true
            }
            map error body.map((val) => { return val.toUpperCase(); })
            map error {
              f1: any || 'some string',
              f2: some.var || other.var
            }
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error ['some string', true]
            map error {
              f1: undefined || 'some string',
              f2: some.var || other.var
            }
            map error {
              f1: null || undefined || some.var
            }
            map error {
              f1: some.var
            }
          }`
        );

        describe('with result', () => {
          const profileAst = parseProfileFromSource(
            `usecase Test {
              error {
                f1 string
                f2 boolean
              }
            }`
          );

          validWithWarnings(profileAst, [mapAst1]);
          invalidWithErrors(
            profileAst,
            [mapAst2],
            [
              "ArrayLiteralExpression - Wrong Structure: expected {f1: string, f2: boolean}, but got ['some string', true]",
            ],
            []
          );
        });

        describe('with strict result', () => {
          const profileAst = parseProfileFromSource(
            `usecase Test {
              error {
                f1! string!
                f2! boolean!
              }!
            }`
          );

          validWithWarnings(profileAst, [mapAst1]);
          invalidWithErrors(
            profileAst,
            [mapAst2],
            [
              "ArrayLiteralExpression - Wrong Structure: expected {f1: string!, f2: boolean!}, but got ['some string', true]",
              'Identifier - Wrong Structure: expected string, but got undefined',
              'NullKeyword - Wrong Structure: expected string!, but got null',
              'Identifier - Wrong Structure: expected string, but got undefined',
              'ObjectLiteralExpression - Missing required field',
              'ObjectLiteralExpression - Missing required field',
            ],
            []
          );
        });
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

        validWithWarnings(profileAst, [mapAst1]);
        invalidWithErrors(
          profileAst,
          [mapAst2],
          [
            'ObjectLiteralExpression - Wrong Structure: expected [string | boolean], but got {...a.map(val => val.toUpperCase())}',
            `ObjectLiteralExpression - Wrong Structure: expected [string | boolean], but got {
              f1: 'some string',
              f2: true
            }`,
          ],
          []
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
            map error 'string' + 'true'
            map error "some " + "string"
            map error String(24)
            map error ['some ', 'string'].join('')
            map error \`some \${jesus}\`
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error ['some string', true]
            map error {
              f1: 'some string',
              f2: true
            }
            map error 1 + "true"
            map error true
            map error false
            map error 2+25
          }`
        );

        validWithWarnings(profileAst, [mapAst1]);
        invalidWithErrors(
          profileAst,
          [mapAst2],
          [
            "ArrayLiteralExpression - Wrong Structure: expected string, but got ['some string', true]",
            `ObjectLiteralExpression - Wrong Structure: expected string, but got {
              f1: 'some string',
              f2: true
            }`,
            'FirstLiteralToken - Wrong Structure: expected string, but got 1',
            'PrimitiveLiteral - Wrong Structure: expected string, but got true',
            'PrimitiveLiteral - Wrong Structure: expected string, but got false',
            'FirstLiteralToken - Wrong Structure: expected string, but got 2',
            'FirstLiteralToken - Wrong Structure: expected string, but got 25',
          ],
          []
        );
      });
    });

    describe('result is enum', () => {
      const profileAst = parseProfileFromSource(`usecase FaceDetection {
        result {
          emotions! emotions!
        }!
      }
      
      model emotions {
        happiness! likelihood!
        anger! likelihood!
        sadness! likelihood!
        surprise! likelihood!
      }
      
      model likelihood enum {
        unknown
        veryUnlikely
        unlikely
        possible
        likely
        veryLikely
      }`);

      const validMapAst1 = parseMapFromSource(`map FaceDetection {
        map result {
          emotions: {
            anger: "unknown",
            happiness: "veryUnlikely",
            sadness: "unlikely",
            surprise: "veryLikely",
          },
        }
      }`);

      const validMapAst2 = parseMapFromSource(`map FaceDetection {
        map result {
          emotions: {
            anger: \`unknown\`,
            happiness: \`veryUnlikely\`,
            sadness: \`unlikely\`,
            surprise: \`veryLikely\`,
          },
        }
      }`);

      const invalidMapAst1 = parseMapFromSource(`map FaceDetection {
        map result {
          emotions: {
            anger: "invalid",
            happiness: "invalid",
            sadness: "invalid",
            surprise: "invalid",
          },
        }
      }`);

      const invalidMapAst2 = parseMapFromSource(`map FaceDetection {
        map result {
          emotions: {
            anger: \`invalid\`,
            happiness: \`invalid\`,
            sadness: \`invalid\`,
            surprise: \`invalid\`,
          },
        }
      }`);

      validWithWarnings(profileAst, [validMapAst1, validMapAst2]);

      invalidWithErrors(
        profileAst,
        [invalidMapAst1, invalidMapAst2],
        [
          'StringLiteral - Wrong Structure: expected unknown or veryUnlikely or unlikely or possible or likely or veryLikely, but got invalid',
          'StringLiteral - Wrong Structure: expected unknown or veryUnlikely or unlikely or possible or likely or veryLikely, but got invalid',
          'StringLiteral - Wrong Structure: expected unknown or veryUnlikely or unlikely or possible or likely or veryLikely, but got invalid',
          'StringLiteral - Wrong Structure: expected unknown or veryUnlikely or unlikely or possible or likely or veryLikely, but got invalid',
        ],
        [],
        [
          'FirstTemplateToken - Wrong Structure: expected unknown or veryUnlikely or unlikely or possible or likely or veryLikely, but got invalid',
          'FirstTemplateToken - Wrong Structure: expected unknown or veryUnlikely or unlikely or possible or likely or veryLikely, but got invalid',
          'FirstTemplateToken - Wrong Structure: expected unknown or veryUnlikely or unlikely or possible or likely or veryLikely, but got invalid',
          'FirstTemplateToken - Wrong Structure: expected unknown or veryUnlikely or unlikely or possible or likely or veryLikely, but got invalid',
        ],
        []
      );
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
        invalid(profileAst, [mapAst2]);
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
        invalid(profileAst, [mapAst2]);
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
        invalid(profileAst, [mapAst3, mapAst4]);
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
        invalid(profileAst, [mapAst3]);
      });

      describe('wrong structure', () => {
        const mapAst1 = parseMapFromSource(
          `map Test {
            a.b = false
            map result a.b
          }`
        );

        invalid(profileAst, [mapAst1]);
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

        invalid(profileAst, [mapAst1]);
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
            f1.inner = "hi"
          }
        }`
      );

      valid(profileAst, [mapAst]);
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
            f1.inner = "heyo"
          }
        }`
      );

      valid(profileAst, [mapAst]);
    });
  });

  describe('input', () => {
    const profileAstStrict = parseProfileFromSource(
      `usecase Test {
        input {
          person! {
            from! string!
            to! string!
          }!

          to! string!
          from! string!
          text! string!
        }
      }`
    );
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

      describe('with input', () => {
        validWithWarnings(
          profileAst,
          [mapAst1],
          [
            'OutcomeStatement - Result Not Found: returning "OK", but there is no Result defined in usecase',
          ]
        );
        invalidWithErrors(
          profileAst,
          [mapAst2],
          [
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string, to: string}, to: string, from: string, text: string}, but got input.wrong',
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string, to: string}, to: string, from: string, text: string}, but got input.person.wrong',
          ],
          [
            'OutcomeStatement - Result Not Found: returning "OK", but there is no Result defined in usecase',
          ]
        );
      });

      describe('with strict input', () => {
        validWithWarnings(
          profileAstStrict,
          [mapAst1],
          [
            'OutcomeStatement - Result Not Found: returning "OK", but there is no Result defined in usecase',
          ]
        );
        invalidWithErrors(
          profileAstStrict,
          [mapAst2],
          [
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string!, to: string!}!, to: string!, from: string!, text: string!}, but got input.wrong',
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string!, to: string!}!, to: string!, from: string!, text: string!}, but got input.person.wrong',
          ],
          [
            'OutcomeStatement - Result Not Found: returning "OK", but there is no Result defined in usecase',
          ]
        );
      });
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

      describe('with input', () => {
        validWithWarnings(profileAst, [mapAst1]);
        invalidWithErrors(
          profileAst,
          [mapAst2],
          [
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string, to: string}, to: string, from: string, text: string}, but got input.wrong',
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string, to: string}, to: string, from: string, text: string}, but got input.person.wrong',
          ],
          []
        );
      });

      describe('with strict input', () => {
        validWithWarnings(profileAstStrict, [mapAst1]);
        invalidWithErrors(
          profileAstStrict,
          [mapAst2],
          [
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string!, to: string!}!, to: string!, from: string!, text: string!}, but got input.wrong',
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string!, to: string!}!, to: string!, from: string!, text: string!}, but got input.person.wrong',
          ],
          []
        );
      });
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

      describe('with input', () => {
        validWithWarnings(
          profileAst,
          [mapAst1],
          [
            'OutcomeStatement - Result Not Found: returning input.person.from, but there is no Result defined in usecase',
          ]
        );
        invalidWithErrors(
          profileAst,
          [mapAst2],
          [
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string, to: string}, to: string, from: string, text: string}, but got input.person.wrong',
          ],
          [
            'OutcomeStatement - Result Not Found: returning input.person.wrong, but there is no Result defined in usecase',
          ]
        );
      });

      describe('with strict input', () => {
        validWithWarnings(
          profileAstStrict,
          [mapAst1],
          [
            'OutcomeStatement - Result Not Found: returning input.person.from, but there is no Result defined in usecase',
          ]
        );
        invalidWithErrors(
          profileAstStrict,
          [mapAst2],
          [
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string!, to: string!}!, to: string!, from: string!, text: string!}, but got input.person.wrong',
          ],
          [
            'OutcomeStatement - Result Not Found: returning input.person.wrong, but there is no Result defined in usecase',
          ]
        );
      });
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

      describe('with input', () => {
        validWithWarnings(profileAst, [mapAst1]);
        invalidWithErrors(
          profileAst,
          [mapAst2],
          [
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string, to: string}, to: string, from: string, text: string}, but got input.person.wrong',
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string, to: string}, to: string, from: string, text: string}, but got input.so.wrong',
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string, to: string}, to: string, from: string, text: string}, but got input.person.something.really.wrong.do.not.do.this',
          ],
          []
        );
      });

      describe('with strict input', () => {
        validWithWarnings(profileAstStrict, [mapAst1]);
        invalidWithErrors(
          profileAstStrict,
          [mapAst2],
          [
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string!, to: string!}!, to: string!, from: string!, text: string!}, but got input.person.wrong',
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string!, to: string!}!, to: string!, from: string!, text: string!}, but got input.so.wrong',
            'PropertyAccessExpression - Wrong Input Structure: expected {person: {from: string!, to: string!}!, to: string!, from: string!, text: string!}, but got input.person.something.really.wrong.do.not.do.this',
          ],
          []
        );
      });
    });

    describe('input has an array with element access', () => {
      const profile = parseProfileFromSource(
        `usecase Test {
          input {
            arr [InputItem]
            and [{ another! { one! [number] } }]
          }

          result string!
          error string!
        }
        
        model InputItem {
          foo string!
        }`
      );
      const map1 = parseMapFromSource(
        `map Test {
          set {
            thing = input.arr[0],
            thang = input.and[1].another.one[0]
          }

          map result "ok"
          map error if (thing.foo !== "ok") "error"
        }`
      );
      const map2 = parseMapFromSource(
        `map Test {
        set {
          rebind = input.arr,
          then = rebind[0]
        }

        map result "ok"
        map error if (thing.foo !== "ok") "error"
      }`
      );

      valid(profile, [map1, map2]);
    });
  });

  describe('input & result', () => {
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
          some.variable = "string"
          http POST "http://example.com/{some.variable}/{input.to}" {
            response 200 {
              map result {
                from = "some string"
                text = "some string"
              }
            }
          }
        }`
      );
      const mapAst3 = parseMapFromSource(
        `map Test {
          http POST "http://www.example.com/{input.wrong}" {
            response 200 {
              map result {
                from = "some string"
                text = "some string"
              }
            }
          }
        }`
      );
      const mapAst4 = parseMapFromSource(
        `map Test {
          some.variable = "string"
          http POST "http://example.com/{some.variable}/{input.from}" {
            response 200 {
              map result {
                from = {}
                text = "some string"
              }
            }
          }
        }`
      );

      validWithWarnings(profileAst, [mapAst1, mapAst2]);
      invalidWithErrors(
        profileAst,
        [mapAst3, mapAst4],
        [
          'PropertyAccessExpression - Wrong Input Structure: expected {to: string, from: any}, but got input.wrong',
        ],
        [],
        [
          'ObjectLiteralExpression - Wrong Structure: expected string, but got {}',
        ],
        []
      );
    });

    describe('map is using inline call', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          input {
            from boolean
          }

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
          return {}
        }
        
        map Test {
          from = call Foo(param = input.from)
          text = call Bar()

          outcomeValue = {
            from: from,
            text: text
          }

          map result outcomeValue
        }`
      );
      const mapAst3 = parseMapFromSource(
        `operation Foo {
          return true
        }
        
        map Test {
          map result {
            from = call Foo()
            text = true
          }
        }`
      );
      const mapAst4 = parseMapFromSource(
        `operation Foo {
          return "some string"
        }
        
        operation Bar {
          return {}
        }
        
        map Test {
          from = call Foo(param = input.wrong)
          text = call Bar()

          outcomeValue = {
            from: from,
            text: text
          }

          map result outcomeValue
        }`
      );

      validWithWarnings(profileAst, [mapAst1, mapAst2]);
      invalidWithErrors(
        profileAst,
        [mapAst3, mapAst4],
        ['PrimitiveLiteral - Wrong Structure: expected string, but got true'],
        [],
        [
          'PropertyAccessExpression - Wrong Input Structure: expected {from: boolean}, but got input.wrong',
        ],
        []
      );
    });
  });

  describe('usecase-map compatibility', () => {
    describe('multiple maps', () => {
      const profileAst = parseProfileFromSource(
        `usecase Test {
          result string
        }
        
        usecase Test2 {
          result boolean
        }
        `
      );
      const mapAst = parseMapFromSource(
        `map Test {
          map result "some string"
        }
        
        map Test2 {
          map result true
        }`
      );

      valid(profileAst, [mapAst]);
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

      invalid(profileAst, [mapAst]);
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

      invalid(profileAst, [mapAst]);
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

      invalid(profileAst, [mapAst]);
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

      invalid(profileAst, [mapAst]);
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

      validWarn(profileAst, [mapAst]);
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

      validWarn(profileAst, [mapAst]);
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

      invalid(profileAst, [mapAst]);
    });
  });
});
