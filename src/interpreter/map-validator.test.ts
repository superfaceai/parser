import {
  isMapDocumentNode,
  MapASTNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';

import { parseMap, parseProfile, Source } from '..';
import { formatIssues, getProfileOutput, validateMap } from './utils';

function getIssues(profile: ProfileDocumentNode, maps: MapASTNode[]) {
  const profileOutput = getProfileOutput(profile);
  const output: Record<string, { errors?: string; warnings?: string }> = {};
  let id: string | undefined;

  for (const map of maps) {
    if (isMapDocumentNode(map)) {
      id = `${map.header.profile.name}-${map.header.provider}`;
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
    expect(getIssues(profile, maps)).toMatchSnapshot();
  });
}

function invalid(profile: ProfileDocumentNode, maps: MapASTNode[]): void {
  it('then validation will fail', () => {
    expect(getIssues(profile, maps)).toMatchSnapshot();
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
      });

      describe('non null field f1', () => {
        const profileAst = parseProfileFromSource(
          `usecase Test {
            result {
              f1 string!
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

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(profileAst, [mapAst3]);
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
          }`
        );

        valid(profileAst, [mapAst1]);
        invalid(profileAst, [mapAst2]);
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
            map error {
              f1 = "some string"
              f2 = 2
              f3 = 3
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
            map result body.map((val) => { return val.toUpperCase(); })
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            map result ['some string', true]
          }`
        );

        valid(profileAst, [mapAst1]);
        invalid(profileAst, [mapAst2]);
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
        invalid(profileAst, [mapAst2]);
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
            map result 1 + "true"
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
            map result true
            map result false
            map result 2+25
          }`
        );

        valid(profileAst, [mapAst1]);
        invalid(profileAst, [mapAst2]);
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
            map error body.map((val) => { return val.toUpperCase(); })
          }`
        );
        const mapAst2 = parseMapFromSource(
          `map Test {
            map error ['some string', true]
          }`
        );

        valid(profileAst, [mapAst1]);
        invalid(profileAst, [mapAst2]);
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
        invalid(profileAst, [mapAst2]);
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
            map error 1 + "true"
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
            map error true
            map error false
            map error 2+25
          }`
        );

        valid(profileAst, [mapAst1]);
        invalid(profileAst, [mapAst2]);
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
            f1.inner = {}
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
            f1.inner = {}
          }
          map error if (cond) "some string"
        }`
      );

      valid(profileAst, [mapAst]);
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

      valid(profileAst, [mapAst1]);
      invalid(profileAst, [mapAst2]);
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

      valid(profileAstStrict, [mapAst1]);
      valid(profileAst, [mapAst1]);
      invalid(profileAstStrict, [mapAst2]);
      invalid(profileAst, [mapAst2]);
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

      valid(profileAstStrict, [mapAst1]);
      valid(profileAst, [mapAst1]);
      invalid(profileAstStrict, [mapAst2]);
      invalid(profileAst, [mapAst2]);
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

      valid(profileAstStrict, [mapAst1]);
      valid(profileAst, [mapAst1]);
      invalid(profileAstStrict, [mapAst2]);
      invalid(profileAst, [mapAst2]);
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

      valid(profileAstStrict, [mapAst1]);
      valid(profileAst, [mapAst1]);
      invalid(profileAstStrict, [mapAst2]);
      invalid(profileAst, [mapAst2]);
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

      valid(profileAst, [mapAst]);
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

      valid(profileAst, [mapAst]);
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
