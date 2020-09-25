import { ProfileDocumentNode } from '@superindustries/language';

import {
  ObjectStructure,
  ProfileOutput,
  ProfileValidator,
} from './profile-validator';

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
          input: {
            kind: 'ObjectStructure',
          },
          result: {
            kind: 'UnionStructure',
            types: [
              { kind: 'ObjectStructure' },
              {
                kind: 'NonNullStructure',
                required: true,
                value: {
                  kind: 'NonNullStructure',
                  required: true,
                  value: {
                    kind: 'PrimitiveStructure',
                  },
                },
              },
              {
                kind: 'NonNullStructure',
                required: true,
                value: {
                  kind: 'ListStructure',
                  value: {
                    kind: 'UnionStructure',
                    types: [
                      {
                        kind: 'NonNullStructure',
                        required: true,
                        value: { kind: 'PrimitiveStructure' },
                      },
                      {
                        kind: 'NonNullStructure',
                        required: true,
                        value: { kind: 'PrimitiveStructure' },
                      },
                    ],
                  },
                },
              },
              {
                kind: 'NonNullStructure',
                required: true,
                value: {
                  kind: 'EnumStructure',
                },
              },
              {
                kind: 'ObjectStructure',
                fields: {
                  f1: {
                    kind: 'PrimitiveStructure',
                  },
                },
              },
              {
                kind: 'ObjectStructure',
                fields: {
                  f1: {
                    kind: 'NonNullStructure',
                    required: true,
                    value: {
                      kind: 'PrimitiveStructure',
                    },
                  },
                  f2: {
                    kind: 'UnionStructure',
                    types: [
                      {
                        kind: 'NonNullStructure',
                        required: true,
                        value: { kind: 'PrimitiveStructure' },
                      },
                      {
                        kind: 'NonNullStructure',
                        required: true,
                        value: { kind: 'PrimitiveStructure' },
                      },
                    ],
                  },
                },
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
      const expectedObjectStructure: ObjectStructure = {
        kind: 'ObjectStructure',
        fields: {
          f1: { kind: 'PrimitiveStructure' },
          f2: { kind: 'PrimitiveStructure' },
        },
      };
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
              expectedObjectStructure,
              expectedObjectStructure,
              expectedObjectStructure,
              expectedObjectStructure,
            ],
          },
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
    describe('and Result is a Union Type that reference NamedModels of Object Types that references NamedFields', () => {
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
          input: {
            kind: 'ObjectStructure',
          },
          result: {
            kind: 'UnionStructure',
            types: [
              {
                kind: 'ObjectStructure',
                fields: {
                  f1: {
                    kind: 'UnionStructure',
                    types: [
                      {
                        kind: 'NonNullStructure',
                        required: true,
                        value: {
                          kind: 'ObjectStructure',
                          fields: {
                            if1: {
                              kind: 'PrimitiveStructure',
                            },
                            if2: {
                              kind: 'PrimitiveStructure',
                            },
                          },
                        },
                      },
                      {
                        kind: 'NonNullStructure',
                        required: true,
                        value: undefined,
                      },
                    ],
                  },
                  f2: {
                    kind: 'NonNullStructure',
                    required: true,
                    value: {
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
                },
              },
              {
                kind: 'ObjectStructure',
                fields: {
                  f3: {
                    kind: 'NonNullStructure',
                    required: true,
                    value: {
                      kind: 'EnumStructure',
                    },
                  },
                  f4: {
                    kind: 'ObjectStructure',
                    fields: {
                      inner: {
                        kind: 'NonNullStructure',
                        required: true,
                        value: {
                          kind: 'ObjectStructure',
                          fields: {
                            value: {
                              kind: 'UnionStructure',
                              types: [
                                {
                                  kind: 'EnumStructure',
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
                                  kind: 'ObjectStructure',
                                  fields: {
                                    if1: {
                                      kind: 'PrimitiveStructure',
                                    },
                                    if2: {
                                      kind: 'PrimitiveStructure',
                                    },
                                  },
                                },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
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
  });
});
