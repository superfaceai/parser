import fs from 'fs';
import { ProfileDocumentNode } from '@superindustries/language';
import { ProfileValidator, ProfileOutput } from './profile-validator';

function writeToFile(output: ProfileOutput) {
  const json = JSON.stringify(output, null, 2);
  fs.writeFileSync(__dirname + '/test.json', json);
}

describe('ProfileValidator Advanced', () => {
  describe('When Profile has empty Input', () => {
    /**
     *  Notation of profile:
     
        model m1 boolean!
        model m2 string! | boolean!
     
        usecase testUsecase {
            input {}
            result {} | m1! | [string! | boolean!]! | enum { S B }! | {f1 string} | {f1 m1, f2 m2}
        }
     *
     */
    describe('and Result is a Union Type with multiple Types', () => {
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

    /**
     * Notation of profile:
     
        field f1 string
        field f2 boolean

        model m1 {
          f1 string
          f2 boolean
        }
        model m2 {
          f1
          f2
        }
        usecase myCase {
          input {}
          result m1 | { f1 string f2 boolean } | m2 | { f1, f2 }
        }
     *
     */
    describe('and Result is a Union Type that reference NamedModels of Object Types that reference NamedFields', () => {
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
                  name: 'm1',
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
                    {
                      kind: 'FieldDefinition',
                      fieldName: 'f2',
                      type: {
                        kind: 'PrimitiveTypeName',
                        name: 'boolean',
                      },
                    },
                  ],
                },
                {
                  kind: 'ModelTypeName',
                  name: 'm2',
                },
                {
                  kind: 'ObjectDefinition',
                  fields: [
                    {
                      kind: 'FieldDefinition',
                      fieldName: 'f1',
                    },
                    {
                      kind: 'FieldDefinition',
                      fieldName: 'f2',
                    },
                  ],
                },
              ],
            },
          },
          {
            kind: 'NamedModelDefinition',
            modelName: 'm2',
            type: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'f1',
                },
                {
                  kind: 'FieldDefinition',
                  fieldName: 'f2',
                },
              ],
            },
          },
          {
            kind: 'NamedModelDefinition',
            modelName: 'm1',
            type: {
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
                {
                  kind: 'FieldDefinition',
                  fieldName: 'f2',
                  type: {
                    kind: 'PrimitiveTypeName',
                    name: 'boolean',
                  },
                },
              ],
            },
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'f1',
            type: {
              kind: 'PrimitiveTypeName',
              name: 'string',
            },
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'f2',
            type: {
              kind: 'PrimitiveTypeName',
              name: 'boolean',
            },
          },
        ],
      };

      const profileValidator = new ProfileValidator();
      const expectedObjectStructure = {
        f1: { primitiveType: 'string' },
        f2: { primitiveType: 'boolean' },
      };
      const expected: ProfileOutput = {
        profileId: 'test',
        usecase: {
          useCaseName: 'Test',
          input: {},
          result: [
            expectedObjectStructure,
            expectedObjectStructure,
            expectedObjectStructure,
            expectedObjectStructure,
          ],
        },
      };

      test('then result contains UnionStructure', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });

    /**
     * Notation of profile:
     
        field f1 {
            if1 string
            if2 boolean
        }! | m1!
        field f2 [string | boolean]!
        field f3 enum {STRING BOOLEAN}!
        field f4 {
            inner {
                value enum {STRING BOOLEAN} | [string | boolean] | {if1 string if2 boolean}
            }!
        }

        model m1 {
            f1 
            f2
        }
        model m2 {
            f3
            f4
        }

        usecase myCase {
            input {}
            result m1 | m2
        }
     *
     */
    describe.only('and Result is a Union Type that reference NamedModels of Object Types that reference NamedFields', () => {
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
            kind: 'NamedFieldDefinition',
            fieldName: 'f1',
            type: {
              kind: 'UnionDefinition',
              types: [
                {
                  kind: 'NonNullDefinition',
                  type: {
                    kind: 'ObjectDefinition',
                    fields: [
                      {
                        kind: 'FieldDefinition',
                        fieldName: 'if1',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                      {
                        kind: 'FieldDefinition',
                        fieldName: 'if2',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'boolean',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'NonNullDefinition',
                  type: {
                    kind: 'ModelTypeName',
                    name: 'm1',
                  },
                },
              ],
            },
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'f2',
            type: {
              kind: 'NonNullDefinition',
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
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'f3',
            type: {
              kind: 'NonNullDefinition',
              type: {
                kind: 'EnumDefinition',
                values: [
                  {
                    kind: 'EnumValue',
                    value: 'STRING',
                  },
                  {
                    kind: 'EnumValue',
                    value: 'BOOLEAN',
                  },
                ],
              },
            },
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'f4',
            type: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'inner',
                  type: {
                    kind: 'NonNullDefinition',
                    type: {
                      kind: 'ObjectDefinition',
                      fields: [
                        {
                          kind: 'FieldDefinition',
                          fieldName: 'value',
                          type: {
                            kind: 'UnionDefinition',
                            types: [
                              {
                                kind: 'EnumDefinition',
                                values: [
                                  {
                                    kind: 'EnumValue',
                                    value: 'STRING',
                                  },
                                  {
                                    kind: 'EnumValue',
                                    value: 'BOOLEAN',
                                  },
                                ],
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
                                kind: 'ObjectDefinition',
                                fields: [
                                  {
                                    kind: 'FieldDefinition',
                                    fieldName: 'if1',
                                    type: {
                                      kind: 'PrimitiveTypeName',
                                      name: 'string',
                                    },
                                  },
                                  {
                                    kind: 'FieldDefinition',
                                    fieldName: 'if2',
                                    type: {
                                      kind: 'PrimitiveTypeName',
                                      name: 'boolean',
                                    },
                                  },
                                ],
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
          {
            kind: 'NamedModelDefinition',
            modelName: 'm1',
            type: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'f1',
                },
                {
                  kind: 'FieldDefinition',
                  fieldName: 'f2',
                },
              ],
            },
          },
          {
            kind: 'NamedModelDefinition',
            modelName: 'm2',
            type: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'f3',
                },
                {
                  kind: 'FieldDefinition',
                  fieldName: 'f4',
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
              f1: [
                {
                  required: true,
                  requiredType: {
                    if1: {
                      primitiveType: 'string',
                    },
                    if2: {
                      primitiveType: 'boolean',
                    },
                  },
                },
                {
                  required: true,
                  requiredType: {
                    modelType: undefined,
                  },
                },
              ],
              f2: {
                required: true,
                requiredType: [
                  {
                    primitiveType: 'string',
                  },
                  {
                    primitiveType: 'boolean',
                  },
                ],
              },
            },
            {
              f3: {
                required: true,
                requiredType: {
                  STRING: 'STRING',
                  BOOLEAN: 'BOOLEAN',
                },
              },
              f4: {
                inner: {
                  required: true,
                  requiredType: {
                    value: [
                      {
                        STRING: 'STRING',
                        BOOLEAN: 'BOOLEAN',
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
                        if1: {
                          primitiveType: 'string',
                        },
                        if2: {
                          primitiveType: 'boolean',
                        },
                      },
                    ],
                  },
                },
              },
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
