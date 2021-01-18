import { ProfileDocumentNode, ProfileHeaderNode } from '@superfaceai/ast';

import { ProfileIOAnalyzer } from './profile-io-analyzer';
import { ObjectStructure, ProfileOutput } from './profile-output';

const header: ProfileHeaderNode = {
  kind: 'ProfileHeader',
  name: 'test',
  version: {
    major: 0,
    minor: 0,
    patch: 0,
  },
};

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
        header,
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
                        required: false,
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
                        required: false,
                        fieldName: 'f1',
                        type: {
                          kind: 'ModelTypeName',
                          name: 'm1',
                        },
                      },
                      {
                        kind: 'FieldDefinition',
                        required: false,
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
          },
        ],
      };
      // result {} | m1! | [string! | boolean!]! | enum { S B }! | {f1 string} | {f1 m1, f2 m2}
      const profileValidator = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header: {
          name: 'test',
          version: {
            major: 0,
            minor: 0,
            patch: 0,
          },
        },
        usecases: [
          {
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
                  value: {
                    kind: 'NonNullStructure',
                    value: {
                      kind: 'PrimitiveStructure',
                      type: 'boolean',
                    },
                  },
                },
                {
                  kind: 'NonNullStructure',
                  value: {
                    kind: 'ListStructure',
                    value: {
                      kind: 'UnionStructure',
                      types: [
                        {
                          kind: 'NonNullStructure',
                          value: { kind: 'PrimitiveStructure', type: 'string' },
                        },
                        {
                          kind: 'NonNullStructure',
                          value: {
                            kind: 'PrimitiveStructure',
                            type: 'boolean',
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  kind: 'NonNullStructure',
                  value: {
                    kind: 'EnumStructure',
                    enums: [{ value: 'S' }, { value: 'B' }],
                  },
                },
                {
                  kind: 'ObjectStructure',
                  fields: {
                    f1: {
                      kind: 'PrimitiveStructure',
                      type: 'string',
                    },
                  },
                },
                {
                  kind: 'ObjectStructure',
                  fields: {
                    f1: {
                      kind: 'NonNullStructure',
                      value: {
                        kind: 'PrimitiveStructure',
                        type: 'boolean',
                      },
                    },
                    f2: {
                      kind: 'UnionStructure',
                      types: [
                        {
                          kind: 'NonNullStructure',
                          value: { kind: 'PrimitiveStructure', type: 'string' },
                        },
                        {
                          kind: 'NonNullStructure',
                          value: {
                            kind: 'PrimitiveStructure',
                            type: 'boolean',
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        ],
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
                    name: 'm1',
                  },
                  {
                    kind: 'ObjectDefinition',
                    fields: [
                      {
                        kind: 'FieldDefinition',
                        required: false,
                        fieldName: 'f1',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                      {
                        kind: 'FieldDefinition',
                        required: false,
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
                ],
              },
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
          {
            kind: 'NamedModelDefinition',
            modelName: 'm1',
            type: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  required: false,
                  fieldName: 'f1',
                  type: {
                    kind: 'PrimitiveTypeName',
                    name: 'string',
                  },
                },
                {
                  kind: 'FieldDefinition',
                  required: false,
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

      const profileValidator = new ProfileIOAnalyzer();
      const expectedObjectStructure: ObjectStructure = {
        kind: 'ObjectStructure',
        fields: {
          f1: { kind: 'PrimitiveStructure', type: 'string' },
          f2: { kind: 'PrimitiveStructure', type: 'boolean' },
        },
      };
      const expected: ProfileOutput = {
        header: {
          name: 'test',
          version: {
            major: 0,
            minor: 0,
            patch: 0,
          },
        },
        usecases: [
          {
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
        ],
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
        }!
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
        header,
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
                        required: false,
                        fieldName: 'if1',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                      {
                        kind: 'FieldDefinition',
                        required: false,
                        fieldName: 'if2',
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
                  required: false,
                  fieldName: 'inner',
                  type: {
                    kind: 'NonNullDefinition',
                    type: {
                      kind: 'ObjectDefinition',
                      fields: [
                        {
                          kind: 'FieldDefinition',
                          required: false,
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
                                    required: false,
                                    fieldName: 'if1',
                                    type: {
                                      kind: 'PrimitiveTypeName',
                                      name: 'string',
                                    },
                                  },
                                  {
                                    kind: 'FieldDefinition',
                                    required: false,
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
          {
            kind: 'NamedModelDefinition',
            modelName: 'm2',
            type: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  required: false,
                  fieldName: 'f3',
                },
                {
                  kind: 'FieldDefinition',
                  required: false,
                  fieldName: 'f4',
                },
              ],
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

      const profileValidator = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header: {
          name: 'test',
          version: {
            major: 0,
            minor: 0,
            patch: 0,
          },
        },
        usecases: [
          {
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
                          value: {
                            kind: 'ObjectStructure',
                            fields: {
                              if1: {
                                kind: 'PrimitiveStructure',
                                type: 'string',
                              },
                              if2: {
                                kind: 'PrimitiveStructure',
                                type: 'boolean',
                              },
                            },
                          },
                        },
                      ],
                    },
                    f2: {
                      kind: 'NonNullStructure',
                      value: {
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
                  },
                },
                {
                  kind: 'ObjectStructure',
                  fields: {
                    f3: {
                      kind: 'NonNullStructure',
                      value: {
                        kind: 'EnumStructure',
                        enums: [{ value: 'STRING' }, { value: 'BOOLEAN' }],
                      },
                    },
                    f4: {
                      kind: 'ObjectStructure',
                      fields: {
                        inner: {
                          kind: 'NonNullStructure',
                          value: {
                            kind: 'ObjectStructure',
                            fields: {
                              value: {
                                kind: 'UnionStructure',
                                types: [
                                  {
                                    kind: 'EnumStructure',
                                    enums: [
                                      { value: 'STRING' },
                                      { value: 'BOOLEAN' },
                                    ],
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
                                    kind: 'ObjectStructure',
                                    fields: {
                                      if1: {
                                        kind: 'PrimitiveStructure',
                                        type: 'string',
                                      },
                                      if2: {
                                        kind: 'PrimitiveStructure',
                                        type: 'boolean',
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
        ],
      };

      test('then result contains UnionStructure', () => {
        const output = profileValidator.visit(ast);
        expect(output).toMatchObject(expected);
      });
    });
  });
});
