import { ProfileDocumentNode } from '@superfaceai/ast';

import { parseProfile } from '..';
import { Source } from '../common/source';
import { ProfileIOAnalyzer } from './profile-io-analyzer';
import { ProfileOutput } from './profile-output';

const header = {
  name: 'test',
  version: {
    major: 1,
    minor: 0,
    patch: 0,
  },
};

const parseProfileFromSource = (source: string): ProfileDocumentNode =>
  parseProfile(
    new Source(
      `
      name = "test"
      version = "1.0.0"
      ` + source
    )
  );

describe('ProfileIOAnalyzer', () => {
  describe('When Profile has empty Input', () => {
    describe('and Result is Primitive Type', () => {
      const ast = parseProfileFromSource(
        `usecase Test {
          input {}
          result string     
        }`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',

            result: {
              kind: 'PrimitiveStructure',
              type: 'string',
            },
          },
        ],
      };

      test('then result contain PrimitiveStructure', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is Enum Type', () => {
      const ast = parseProfileFromSource(
        `usecase Test {
          input {}
          result enum { a, b }
        }`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',

            result: {
              kind: 'EnumStructure',
              enums: [{ value: 'a' }, { value: 'b' }],
            },
          },
        ],
      };

      test('then result contain EnumStructure', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is Enum Type which is NonNull Type', () => {
      const ast = parseProfileFromSource(
        `usecase Test {
          input {}
          result enum { a, b }!
        }`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',

            result: {
              kind: 'NonNullStructure',
              value: {
                kind: 'EnumStructure',
                enums: [{ value: 'a' }, { value: 'b' }],
              },
            },
          },
        ],
      };

      test('then result contain NonNullStructure with EnumStructure', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is Enum Type with named variant', () => {
      const ast = parseProfileFromSource(
        `usecase Test {
          input {}
          result enum { a, b = 'c' }
        }`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',

            result: {
              kind: 'EnumStructure',
              enums: [{ value: 'a' }, { name: 'b', value: 'c' }],
            },
          },
        ],
      };

      test('then result contain EnumStructure', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is Model Type which is defined in definition aswell as useCaseDefinition', () => {
      const ast = parseProfileFromSource(
        `model myModel boolean

        usecase Test {
          input {}
          result myModel
        }`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',

            result: {
              kind: 'PrimitiveStructure',
              type: 'boolean',
            },
          },
        ],
      };

      test('then result contain PrimitiveStructure', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is Model Type which is defined in definition after useCaseDefinition', () => {
      const ast = parseProfileFromSource(
        `usecase Test {
          input {}
          result myModel    
        }

        model myModel boolean`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',

            result: {
              kind: 'PrimitiveStructure',
              type: 'boolean',
            },
          },
        ],
      };

      test('then model definition is evaluated before useCase definition and result contain PrimitiveStructure', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is Model Type which is not defined in ProfileDocument definitions', () => {
      const ast = parseProfileFromSource(
        `usecase Test {
          input {}
          result myModel
        }`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',
            result: {
              kind: 'ScalarStructure',
            },
          },
        ],
      };

      test('then model definition is not evaluated and therefore result modelType is undefined', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is List Type', () => {
      const ast = parseProfileFromSource(
        `usecase Test {
          input {}
          result [string]
        }`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',

            result: {
              kind: 'ListStructure',
              value: {
                kind: 'PrimitiveStructure',
                type: 'string',
              },
            },
          },
        ],
      };

      test('then result contain PrimitiveStructure', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is List Type with Union', () => {
      const ast = parseProfileFromSource(
        `usecase Test {
          input {}
          result [string | boolean]
        }`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',

            result: {
              kind: 'ListStructure',
              value: {
                kind: 'UnionStructure',
                types: [
                  {
                    kind: 'PrimitiveStructure',
                    type: 'string',
                  },
                  {
                    kind: 'PrimitiveStructure',
                    type: 'boolean',
                  },
                ],
              },
            },
          },
        ],
      };

      test('then result contain UnionStructure', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is empty Object Type', () => {
      const ast = parseProfileFromSource(
        `usecase Test {
          input {}
          result {}
        }`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',
            result: {
              kind: 'ObjectStructure',
              fields: {},
            },
          },
        ],
      };

      test('then result is empty ObjectStructure as well', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is a Object Type with fields of multiple Types', () => {
      const ast = parseProfileFromSource(
        `usecase Test {
          input {}
          result {
            f1 myModel
            f2 [string | boolean]
            f3 enum { A, B }
          }
        }
        model myModel boolean`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',
            result: {
              kind: 'ObjectStructure',
              fields: {
                f1: {
                  kind: 'PrimitiveStructure',
                  type: 'boolean',
                },
                f2: {
                  kind: 'ListStructure',
                  value: {
                    kind: 'UnionStructure',
                    types: [
                      {
                        kind: 'PrimitiveStructure',
                        type: 'string',
                      },
                      {
                        kind: 'PrimitiveStructure',
                        type: 'boolean',
                      },
                    ],
                  },
                },
                f3: {
                  kind: 'EnumStructure',
                  enums: [{ value: 'A' }, { value: 'B' }],
                },
              },
            },
          },
        ],
      };

      test('then result contains ObjectStructure', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is a Object Type', () => {
      const ast = parseProfileFromSource(
        `usecase Test {
          input {}
          result {
            test {
              hello {
                goodbye boolean
              }
            }
          }
        }`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',
            result: {
              kind: 'ObjectStructure',
              fields: {
                test: {
                  kind: 'ObjectStructure',
                  fields: {
                    hello: {
                      kind: 'ObjectStructure',
                      fields: {
                        goodbye: {
                          kind: 'PrimitiveStructure',
                          type: 'boolean',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      };

      test('then Result contain ObjectStructure', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is a Union Type with fields of multiple Types', () => {
      const ast = parseProfileFromSource(
        `usecase Test {
          result myModel | [string | boolean] | enum { A, B }
        }
        
        model myModel boolean`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',
            result: {
              kind: 'UnionStructure',
              types: [
                {
                  kind: 'PrimitiveStructure',
                  type: 'boolean',
                },
                {
                  kind: 'ListStructure',
                  value: {
                    kind: 'UnionStructure',
                    types: [
                      {
                        kind: 'PrimitiveStructure',
                        type: 'string',
                      },
                      {
                        kind: 'PrimitiveStructure',
                        type: 'boolean',
                      },
                    ],
                  },
                },
                {
                  kind: 'EnumStructure',
                  enums: [{ value: 'A' }, { value: 'B' }],
                },
              ],
            },
          },
        ],
      };

      test('then result contains UnionStructure', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is a undefined model', () => {
      const ast = parseProfileFromSource(
        `model m1
        
        usecase Test {
          result m1
        }`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',
            result: {
              kind: 'ScalarStructure',
            },
          },
        ],
      };

      test('then result is not defined', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is an Object with undefined fields', () => {
      const ast = parseProfileFromSource(
        `usecase Test {
          result {
            f1
            f2
          }
        }
        
        field f1
        field f2`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',
            result: {
              kind: 'ObjectStructure',
              fields: {
                f1: {
                  kind: 'ScalarStructure',
                },
                f2: {
                  kind: 'ScalarStructure',
                },
              },
            },
          },
        ],
      };

      test('then result is an object with two undefined fields', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is a Union with undefined models', () => {
      const ast = parseProfileFromSource(
        `model m1
        model m2

        usecase Test {
          result m1 | m2 
        }`
      );

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
        usecases: [
          {
            useCaseName: 'Test',
            result: {
              kind: 'UnionStructure',
              types: [
                {
                  kind: 'ScalarStructure',
                },
                {
                  kind: 'ScalarStructure',
                },
              ],
            },
          },
        ],
      };

      test('then result is a Union of two undefined types', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });
  });

  it('should extract documentation strings', () => {
    const ast = parseProfileFromSource(
      `"
        The Test Case
        It tests the case
        "
        usecase Test {
          "
          This is the inputs
          Really
          "
          input {
            "
            Test field
            This is a test field
            "
            testField 
          }

          "
          This is the results
          Would I lie to you?
          "
          result {
            "The result test field"
            resultyTestField
          }

          "
          The ERROR
          "
          error {
            "
            The error message
            "
            message ErrorEnum
          }
        }
        
        "
        the resultyTest field
        it is number
        "
        field resultyTestField number
        
        "
        The Error Enum
        It is either bad or badder
        "
        model ErrorEnum enum {
          "This means bad"
          bad
          "This means badder"
          badder
        }`
    );

    const analyzer = new ProfileIOAnalyzer();
    const result = analyzer.visit(ast);
    const expected: ProfileOutput = {
      header,
      usecases: [
        {
          useCaseName: 'Test',
          title: 'The Test Case',
          description: 'It tests the case',
          safety: undefined,
          input: {
            kind: 'ObjectStructure',
            fields: {
              testField: {
                kind: 'ScalarStructure',
                required: false,
                title: 'Test field',
                description: 'This is a test field',
              },
            },
            title: 'This is the inputs',
            description: 'Really',
          },
          result: {
            kind: 'ObjectStructure',
            fields: {
              resultyTestField: {
                kind: 'PrimitiveStructure',
                required: false,
                type: 'number',
                title: 'The result test field',
                description: 'it is number',
              },
            },
            title: 'This is the results',
            description: 'Would I lie to you?',
          },
          error: {
            kind: 'ObjectStructure',
            fields: {
              message: {
                required: false,
                kind: 'EnumStructure',
                title: 'The error message',
                description: 'It is either bad or badder',
                enums: [
                  {
                    name: 'bad',
                    value: 'bad',
                    title: 'This means bad',
                  },
                  {
                    name: 'badder',
                    value: 'badder',
                    title: 'This means badder',
                  },
                ],
              },
            },
            title: 'The ERROR',
          },
        },
      ],
    };

    expect(result).toStrictEqual(expected);
  });

  it('should correctly reference fields and models', () => {
    const ast = parseProfileFromSource(
      `usecase Test {
        result Output

        error {
          message
        }
      }
      
      field message ErrorEnum
      field to string
      
      model ErrorEnum enum { a, b }
      model Output {
        to
      }`
    );

    const analyzer = new ProfileIOAnalyzer();
    const expected: ProfileOutput = {
      header,
      usecases: [
        {
          useCaseName: 'Test',
          error: {
            kind: 'ObjectStructure',
            fields: {
              message: {
                kind: 'EnumStructure',
                enums: [
                  {
                    value: 'a',
                  },
                  {
                    value: 'b',
                  },
                ],
              },
            },
          },
          result: {
            kind: 'ObjectStructure',
            fields: {
              to: {
                kind: 'PrimitiveStructure',
                type: 'string',
              },
            },
          },
        },
      ],
    };

    const output = analyzer.visit(ast);
    expect(output).toMatchObject(expected);
  });

  describe('when use-case safety is defined', () => {
    it('extracts safety correctly', () => {
      const ast = parseProfileFromSource(`
        usecase Safe safe {
          result string
        }

        usecase Unsafe unsafe {
          result string
        } 

        usecase Idempotent idempotent {
          result string
        }
      `);

      const analyzer = new ProfileIOAnalyzer();
      const output = analyzer.visit(ast);

      expect(output.usecases[0].safety).toBe('safe');
      expect(output.usecases[1].safety).toBe('unsafe');
      expect(output.usecases[2].safety).toBe('idempotent');
    });
  });
});
