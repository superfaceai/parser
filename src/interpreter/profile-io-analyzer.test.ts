import { ProfileDocumentNode, ProfileHeaderNode } from '@superfaceai/ast';

import { ProfileIOAnalyzer } from './profile-io-analyzer';
import { ProfileOutput } from './profile-output';

const header: ProfileHeaderNode = {
  kind: 'ProfileHeader',
  name: 'test',
  version: {
    major: 0,
    minor: 0,
    patch: 0,
  },
};

describe('ProfileIOAnalyzer', () => {
  describe('When Profile has empty Input', () => {
    describe('and Result is Primitive Type', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'PrimitiveTypeName',
                name: 'string',
              },
            },
          },
        ],
      };
      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
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
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'EnumDefinition',
                values: [
                  {
                    kind: 'EnumValue',
                    value: 'a',
                  },
                  {
                    kind: 'EnumValue',
                    value: 'b',
                  },
                ],
              },
            },
          },
        ],
      };

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
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
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'NonNullDefinition',
                type: {
                  kind: 'EnumDefinition',
                  values: [
                    {
                      kind: 'EnumValue',
                      value: 'a',
                    },
                    {
                      kind: 'EnumValue',
                      value: 'b',
                    },
                  ],
                },
              },
            },
          },
        ],
      };

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
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

    describe('and Result is Model Type which is defined in definition aswell as useCaseDefinition', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'NamedModelDefinition',
            modelName: 'myModel',
            type: {
              kind: 'PrimitiveTypeName',
              name: 'boolean',
            },
          },
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ModelTypeName',
                name: 'myModel',
              },
            },
          },
        ],
      };

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
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
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ModelTypeName',
                name: 'myModel',
              },
            },
          },
          {
            kind: 'NamedModelDefinition',
            modelName: 'myModel',
            type: {
              kind: 'PrimitiveTypeName',
              name: 'boolean',
            },
          },
        ],
      };

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
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
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ModelTypeName',
                name: 'myModel',
              },
            },
          },
        ],
      };

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
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
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ListDefinition',
                elementType: {
                  kind: 'PrimitiveTypeName',
                  name: 'string',
                },
              },
            },
          },
        ],
      };

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
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
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ListDefinition',
                elementType: {
                  kind: 'UnionDefinition',
                  types: [
                    {
                      kind: 'PrimitiveTypeName',
                      name: 'string',
                    },
                    {
                      kind: 'PrimitiveTypeName',
                      name: 'boolean',
                    },
                  ],
                },
              },
            },
          },
        ],
      };

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
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
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
          },
        ],
      };

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecases: [
          {
            useCaseName: 'Test',

            result: {
              kind: 'ObjectStructure',
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
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    required: false,
                    fieldName: 'f1',
                    type: {
                      kind: 'ModelTypeName',
                      name: 'myModel',
                    },
                  },
                  {
                    kind: 'FieldDefinition',
                    required: false,
                    fieldName: 'f2',
                    type: {
                      kind: 'ListDefinition',
                      elementType: {
                        kind: 'UnionDefinition',
                        types: [
                          {
                            kind: 'PrimitiveTypeName',
                            name: 'string',
                          },
                          {
                            kind: 'PrimitiveTypeName',
                            name: 'boolean',
                          },
                        ],
                      },
                    },
                  },
                  {
                    kind: 'FieldDefinition',
                    required: false,
                    fieldName: 'f3',
                    type: {
                      kind: 'EnumDefinition',
                      values: [
                        {
                          kind: 'EnumValue',
                          value: 'A',
                        },
                        {
                          kind: 'EnumValue',
                          value: 'B',
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
          {
            kind: 'NamedModelDefinition',
            modelName: 'myModel',
            type: {
              kind: 'PrimitiveTypeName',
              name: 'boolean',
            },
          },
        ],
      };

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
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
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    required: false,
                    fieldName: 'test',
                    type: {
                      kind: 'ObjectDefinition',
                      fields: [
                        {
                          kind: 'FieldDefinition',
                          required: false,
                          fieldName: 'hello',
                          type: {
                            kind: 'ObjectDefinition',
                            fields: [
                              {
                                kind: 'FieldDefinition',
                                required: false,
                                fieldName: 'goodbye',
                                type: {
                                  kind: 'PrimitiveTypeName',
                                  name: 'boolean',
                                },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        ],
      };
      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
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
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'UnionDefinition',
                types: [
                  {
                    kind: 'ModelTypeName',
                    name: 'myModel',
                  },
                  {
                    kind: 'ListDefinition',
                    elementType: {
                      kind: 'UnionDefinition',
                      types: [
                        {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                        {
                          kind: 'PrimitiveTypeName',
                          name: 'boolean',
                        },
                      ],
                    },
                  },
                  {
                    kind: 'EnumDefinition',
                    values: [
                      {
                        kind: 'EnumValue',
                        value: 'A',
                      },
                      {
                        kind: 'EnumValue',
                        value: 'B',
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            kind: 'NamedModelDefinition',
            modelName: 'myModel',
            type: {
              kind: 'PrimitiveTypeName',
              name: 'boolean',
            },
          },
        ],
      };

      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
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
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'NamedModelDefinition',
            modelName: 'm1',
          },
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ModelTypeName',
                name: 'm1',
              },
            },
          },
        ],
      };
      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
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
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    required: false,
                    fieldName: 'f1',
                  },
                  {
                    kind: 'FieldDefinition',
                    required: false,
                    fieldName: 'f2',
                  },
                ],
              },
            },
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'f2',
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'f1',
          },
        ],
      };
      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
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

    describe('and Result is an Union with undefined models', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header,
        definitions: [
          {
            kind: 'NamedModelDefinition',
            modelName: 'm1',
          },
          {
            kind: 'NamedModelDefinition',
            modelName: 'm2',
          },
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'UnionDefinition',
                types: [
                  {
                    kind: 'ModelTypeName',
                    name: 'm1',
                  },
                  {
                    kind: 'ModelTypeName',
                    name: 'm2',
                  },
                ],
              },
            },
          },
        ],
      };
      const analyzer = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        profileId: 'test',
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

      test('then result is an Union of two undefined types', () => {
        const output = analyzer.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });
  });

  it('should extract documentation strings', () => {
    const ast: ProfileDocumentNode = {
      kind: 'ProfileDocument',
      header: {
        kind: 'ProfileHeader',
        name: 'test',
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
        title: 'Test Document',
        description: 'This is a test',
      },
      definitions: [
        {
          kind: 'UseCaseDefinition',
          useCaseName: 'TestCase',
          safety: 'safe',
          input: {
            kind: 'UseCaseSlotDefinition',
            type: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'testField',
                  required: false,
                  title: 'Test field',
                  description: 'This is a test field',
                },
              ],
            },
            title: 'This is the inputs',
            description: 'Really',
          },
          result: {
            kind: 'UseCaseSlotDefinition',
            type: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'resultyTestField',
                  required: false,
                  title: 'The result test field',
                },
              ],
            },
            title: 'This is the results',
            description: 'Would I lie to you?',
          },
          error: {
            kind: 'UseCaseSlotDefinition',
            type: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'message',
                  required: false,
                  title: 'The error message',
                  type: {
                    kind: 'ModelTypeName',
                    name: 'ErrorEnum',
                  },
                },
              ],
            },
            title: 'The ERROR',
          },
          title: 'The Test Case',
          description: 'It tests the case',
        },
        {
          kind: 'NamedFieldDefinition',
          fieldName: 'resultyTestField',
          type: {
            kind: 'PrimitiveTypeName',
            name: 'number',
          },
          title: 'the resultyTest field',
          description: 'it is number',
        },
        {
          kind: 'NamedModelDefinition',
          modelName: 'ErrorEnum',
          type: {
            kind: 'EnumDefinition',
            values: [
              {
                kind: 'EnumValue',
                value: 'bad',
                title: 'This means bad',
              },
              {
                kind: 'EnumValue',
                value: 'badder',
                title: 'This means badder',
              },
            ],
          },
          title: 'The Error Enum',
          description: 'It is either bad or badder',
        },
      ],
    };
    const analyzer = new ProfileIOAnalyzer();
    const result = analyzer.visit(ast);
    const expected: ProfileOutput = {
      profileId: 'test',
      title: 'Test Document',
      description: 'This is a test',
      usecases: [
        {
          useCaseName: 'TestCase',
          title: 'The Test Case',
          description: 'It tests the case',
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
                  { value: 'bad', title: 'This means bad' },
                  { value: 'badder', title: 'This means badder' },
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
});
