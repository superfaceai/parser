import fs from 'fs';
import { ProfileDocumentNode } from '@superindustries/language';
import { ProfileValidator, ProfileOutput } from './profile-validator';

function writeToFile(output: ProfileOutput) {
  const json = JSON.stringify(output, null, 2);
  fs.writeFileSync(__dirname + '/test.json', json);
}

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
              kind: 'ObjectDefinition',
              fields: [],
            },
            result: {
              kind: 'PrimitiveTypeName',
              name: 'string',
            },
          },
        ],
      };
      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {},
          result: {
            primitiveType: 'string',
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
              kind: 'ObjectDefinition',
              fields: [],
            },
            result: {
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
        ],
      };

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {},
          result: {
            a: 'a',
            b: 'b',
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
              kind: 'ObjectDefinition',
              fields: [],
            },
            result: {
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
        ],
      };

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {},
          result: {
            required: true,
            requiredType: {
              a: 'a',
              b: 'b',
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
              kind: 'ObjectDefinition',
              fields: [],
            },
            result: { kind: 'ModelTypeName', name: 'myModel' },
          },
        ],
      };

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {},
          result: {
            primitiveType: 'boolean',
          },
        },
      };

      test('then result contain PrimitiveStructure', () => {
        const output = profileValidator.visit(ast);
        writeToFile(output);
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
              kind: 'ObjectDefinition',
              fields: [],
            },
            result: { kind: 'ModelTypeName', name: 'myModel' },
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
          input: {},
          result: {
            primitiveType: 'boolean',
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
              kind: 'ObjectDefinition',
              fields: [],
            },
            result: { kind: 'ModelTypeName', name: 'myModel' },
          },
        ],
      };

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {},
          result: {
            modelType: undefined,
          },
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
              kind: 'ObjectDefinition',
              fields: [],
            },
            result: {
              kind: 'ListDefinition',
              elementType: {
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
          input: {},
          result: {
            primitiveType: 'string',
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
              kind: 'ObjectDefinition',
              fields: [],
            },
            result: {
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
        ],
      };

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {},
          result: [
            {
              primitiveType: 'string',
            },
            {
              primitiveType: 'boolean',
            },
          ],
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
              kind: 'ObjectDefinition',
              fields: [],
            },
            result: {
              kind: 'ObjectDefinition',
              fields: [],
            },
          },
        ],
      };

      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {},
          result: {},
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
              kind: 'ObjectDefinition',
              fields: [],
            },
            result: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'f1',
                  type: {
                    kind: 'ModelTypeName',
                    name: 'myModel',
                  },
                },
                {
                  kind: 'FieldDefinition',
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
          input: {},
          result: {
            f1: {
              primitiveType: 'boolean',
            },
            f2: [
              {
                primitiveType: 'string',
              },
              {
                primitiveType: 'boolean',
              },
            ],
            f3: {
              A: 'A',
              B: 'B',
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
              kind: 'ObjectDefinition',
              fields: [],
            },
            result: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'test',
                  type: {
                    kind: 'ObjectDefinition',
                    fields: [
                      {
                        kind: 'FieldDefinition',
                        fieldName: 'hello',
                        type: {
                          kind: 'ObjectDefinition',
                          fields: [
                            {
                              kind: 'FieldDefinition',
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
        ],
      };
      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {},
          result: {
            test: {
              hello: {
                goodbye: {
                  primitiveType: 'boolean',
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
              kind: 'ObjectDefinition',
              fields: [],
            },
            result: {
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
          input: {},
          result: [
            {
              primitiveType: 'boolean',
            },
            [
              {
                primitiveType: 'string',
              },
              {
                primitiveType: 'boolean',
              },
            ],
            {
              A: 'A',
              B: 'B',
            },
          ],
        },
      };

      test('then result contains UnionStructure', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });
  });
});
