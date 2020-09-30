import { ProfileDocumentNode } from '@superindustries/language';

import { ProfileOutput, ProfileValidator } from './profile-validator';

describe('ProfileValidator', () => {
  describe('When Profile has empty Input', () => {
    describe('and Result is Primitive Type', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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
      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {
            kind: 'ObjectStructure',
          },
          result: {
            kind: 'PrimitiveStructure',
          },
        },
      };

      test('then result contain PrimitiveStructure', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is Enum Type', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {
            kind: 'ObjectStructure',
          },
          result: {
            kind: 'EnumStructure',
          },
        },
      };

      test('then result contain EnumStructure', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is Enum Type which is NonNull Type', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {
            kind: 'ObjectStructure',
          },
          result: {
            kind: 'NonNullStructure',
            required: true,
            value: {
              kind: 'EnumStructure',
            },
          },
        },
      };

      test('then result contain NonNullStructure with EnumStructure', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is Model Type which is defined in definition aswell as useCaseDefinition', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {
            kind: 'ObjectStructure',
          },
          result: {
            kind: 'PrimitiveStructure',
          },
        },
      };

      test('then result contain PrimitiveStructure', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is Model Type which is defined in definition after useCaseDefinition', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {
            kind: 'ObjectStructure',
          },
          result: {
            kind: 'PrimitiveStructure',
          },
        },
      };

      test('then model definition is evaluated before useCase definition and result contain PrimitiveStructure', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is Model Type which is not defined in ProfileDocument definitions', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {
            kind: 'ObjectStructure',
          },
          result: undefined,
        },
      };

      test('then model definition is not evaluated and therefore result modelType is undefined', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is List Type', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {
            kind: 'ObjectStructure',
          },
          result: {
            kind: 'ListStructure',
            value: {
              kind: 'PrimitiveStructure',
            },
          },
        },
      };

      test('then result contain PrimitiveStructure', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is List Type with Union', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {
            kind: 'ObjectStructure',
          },
          result: {
            kind: 'ListStructure',
            value: {
              kind: 'UnionStructure',
              types: [
                {
                  kind: 'PrimitiveStructure',
                },
                {
                  kind: 'PrimitiveStructure',
                },
              ],
            },
          },
        },
      };

      test('then result contain UnionStructure', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is empty Object Type', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {
            kind: 'ObjectStructure',
          },
          result: {
            kind: 'ObjectStructure',
          },
        },
      };

      test('then result is empty ObjectStructure as well', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is a Object Type with fields of multiple Types', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {
            kind: 'ObjectStructure',
          },
          result: {
            kind: 'ObjectStructure',
            fields: {
              f1: {
                kind: 'PrimitiveStructure',
              },
              f2: {
                kind: 'ListStructure',
                value: {
                  kind: 'UnionStructure',
                  types: [
                    {
                      kind: 'PrimitiveStructure',
                    },
                    {
                      kind: 'PrimitiveStructure',
                    },
                  ],
                },
              },
              f3: {
                kind: 'EnumStructure',
              },
            },
          },
        },
      };

      test('then result contains ObjectStructure', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is a Object Type', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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
      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {
            kind: 'ObjectStructure',
          },
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
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      test('then Result contain ObjectStructure', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is a Union Type with fields of multiple Types', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {
            kind: 'ObjectStructure',
          },
          result: {
            kind: 'UnionStructure',
            types: [
              {
                kind: 'PrimitiveStructure',
              },
              {
                kind: 'ListStructure',
                value: {
                  kind: 'UnionStructure',
                  types: [
                    {
                      kind: 'PrimitiveStructure',
                    },
                    {
                      kind: 'PrimitiveStructure',
                    },
                  ],
                },
              },
              {
                kind: 'EnumStructure',
              },
            ],
          },
        },
      };

      test('then result contains UnionStructure', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is a undefined model', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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
      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          result: undefined,
        },
      };

      test('then result is not defined', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is an Object with undefined fields', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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
      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          result: {
            kind: 'ObjectStructure',
            fields: {
              f1: undefined,
              f2: undefined,
            },
          },
        },
      };

      test('then result is an object with two undefined fields', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    describe('and Result is an Union with undefined models', () => {
      const ast: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        profile: {
          kind: 'Profile',
          profileId: {
            kind: 'ProfileId',
            profileId: 'test',
          },
        },
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
      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          result: {
            kind: 'UnionStructure',
            types: [undefined, undefined],
          },
        },
      };

      test('then result is an Union of two undefined types', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });
  });
});
