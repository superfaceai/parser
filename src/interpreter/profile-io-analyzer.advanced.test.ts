import { ProfileDocumentNode } from '@superfaceai/ast';

import { parseProfile, Source } from '..';
import { ProfileIOAnalyzer } from './profile-io-analyzer';
import { ObjectStructure, ProfileOutput } from './profile-output';

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

describe('ProfileValidator Advanced', () => {
  describe('When Profile has empty Input', () => {
    describe('and Result is a Union Type with multiple Types', () => {
      const ast = parseProfileFromSource(
        `model m1 boolean!
        model m2 string! | boolean!

        usecase Test {
          input {}
          result {} | m1! | [string! | boolean!]! | enum { S, B }! | {f1 string} | {f1 m1, f2 m2}
        }`
      );

      const profileValidator = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
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

    describe('and Result is a Union Type that reference NamedModels of Object Types that reference NamedFields', () => {
      const ast = parseProfileFromSource(
        `usecase Test {
          input {}
          result m1 | { f1 string, f2 boolean } | m2 | { f1, f2 }
        }
        
        model m2 { f1, f2 }
        model m1 { f1 string, f2 boolean }
        
        field f1 string
        field f2 boolean`
      );

      const profileValidator = new ProfileIOAnalyzer();
      const expectedObjectStructure: ObjectStructure = {
        kind: 'ObjectStructure',
        fields: {
          f1: { kind: 'PrimitiveStructure', type: 'string' },
          f2: { kind: 'PrimitiveStructure', type: 'boolean' },
        },
      };
      const expected: ProfileOutput = {
        header,
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

    describe('and Result is a Union Type that reference NamedModels of Object Types that references NamedFields', () => {
      const ast = parseProfileFromSource(
        `field f1 { if1 string, if2 boolean }!
        field f2 [string | boolean]!
        field f3 enum {STRING, BOOLEAN}!
        field f4 {
            inner {
                value enum {STRING, BOOLEAN} | [string | boolean] | {if1 string, if2 boolean}
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

        usecase Test {
            input {}
            result m1 | m2
        }`
      );

      const profileValidator = new ProfileIOAnalyzer();
      const expected: ProfileOutput = {
        header,
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
