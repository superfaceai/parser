import fs from 'fs';
import { ProfileDocumentNode } from '@superindustries/language';
import { ProfileValidator, ProfileOutput } from './profile-validator';

function writeToFile(output: ProfileOutput) {
  const json = JSON.stringify(output, null, 2);
  fs.writeFileSync(__dirname + '/test.json', json);
}

describe('ProfileValidator', () => {
  describe('When Profile has empty Input', () => {
    /**
     * Notation of this usecease Result is:
     * `result {} | m1! | [string! | boolean!]! | enum { S B }! | {f1 string} | {f1 m1, f2 m2}`
     */
    describe.only('and Result is a Union Type with multiple Types', () => {
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
            type: {
              kind: 'NonNullDefinition',
              type: {
                kind: 'PrimitiveTypeName',
                name: 'boolean',
              },
            },
          },
          {
            kind: 'NamedModelDefinition',
            modelName: 'm2',
            type: {
              kind: 'UnionDefinition',
              types: [
                {
                  kind: 'NonNullDefinition',
                  type: {
                    kind: 'PrimitiveTypeName',
                    name: 'string',
                  },
                },
                {
                  kind: 'NonNullDefinition',
                  type: {
                    kind: 'PrimitiveTypeName',
                    name: 'boolean',
                  },
                },
              ],
            },
          },
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
                  kind: 'ObjectDefinition',
                  fields: [],
                },
                {
                  kind: 'NonNullDefinition',
                  type: {
                    kind: 'ModelTypeName',
                    name: 'm1',
                  },
                },
                {
                  kind: 'NonNullDefinition',
                  type: {
                    kind: 'ListDefinition',
                    elementType: {
                      kind: 'UnionDefinition',
                      types: [
                        {
                          kind: 'NonNullDefinition',
                          type: {
                            kind: 'PrimitiveTypeName',
                            name: 'string',
                          },
                        },
                        {
                          kind: 'NonNullDefinition',
                          type: {
                            kind: 'PrimitiveTypeName',
                            name: 'boolean',
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  kind: 'NonNullDefinition',
                  type: {
                    kind: 'EnumDefinition',
                    values: [
                      {
                        kind: 'EnumValue',
                        value: 'S',
                      },
                      {
                        kind: 'EnumValue',
                        value: 'B',
                      },
                    ],
                  },
                },
                {
                  kind: 'ObjectDefinition',
                  fields: [
                    {
                      kind: 'FieldDefinition',
                      fieldName: 'f1',
                      type: {
                        kind: 'PrimitiveTypeName',
                        name: 'string',
                      },
                    },
                  ],
                },
                {
                  kind: 'ObjectDefinition',
                  fields: [
                    {
                      kind: 'FieldDefinition',
                      fieldName: 'f1',
                      type: {
                        kind: 'ModelTypeName',
                        name: 'm1',
                      },
                    },
                    {
                      kind: 'FieldDefinition',
                      fieldName: 'f2',
                      type: {
                        kind: 'ModelTypeName',
                        name: 'm2',
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      };
      // result {} | m1! | [string! | boolean!]! | enum { S B }! | {f1 string} | {f1 m1, f2 m2}
      const profileValidator = new ProfileValidator();
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {},
          result: [
            {},
            {
              required: true,
              requiredType: {
                required: true,
                requiredType: {
                  primitiveType: 'boolean',
                },
              },
            },
            {
              required: true,
              requiredType: [
                { required: true, requiredType: { primitiveType: 'string' } },
                { required: true, requiredType: { primitiveType: 'boolean' } },
              ],
            },
            {
              required: true,
              requiredType: {
                S: 'S',
                B: 'B',
              },
            },
            {
              f1: {
                primitiveType: 'string',
              },
            },
            {
              f1: {
                required: true,
                requiredType: {
                  primitiveType: 'boolean',
                },
              },
              f2: [
                { required: true, requiredType: { primitiveType: 'string' } },
                { required: true, requiredType: { primitiveType: 'boolean' } },
              ],
            },
          ],
        },
      };

      test('then result contains UnionStructure', () => {
        const output = profileValidator.visit(ast);
        writeToFile(output);
        expect(output).toMatchObject(expected);
      });
    });
  });
});
