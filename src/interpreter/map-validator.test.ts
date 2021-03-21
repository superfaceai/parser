import {
  MapASTNode,
  MapHeaderNode,
  ProfileDocumentNode,
  ProfileHeaderNode,
} from '@superfaceai/ast';

import { ValidationIssue } from './issue';
import { ProfileOutput } from './profile-output';
import { formatIssues, getProfileOutput, validateMap } from './utils';

const version = {
  major: 1,
  minor: 0,
  patch: 0,
};

const profileHeader: ProfileHeaderNode = {
  kind: 'ProfileHeader',
  name: 'whatever',
  version,
};

const mapHeader: MapHeaderNode = {
  kind: 'MapHeader',
  profile: {
    name: 'whatever',
    version,
  },
  provider: 'whatever',
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidMap(
        profileOutput: ProfileOutput,
        warning: string,
        error?: string
      ): R;
    }
  }
}

expect.extend({
  toBeValidMap(
    map: MapASTNode,
    profileOutput: ProfileOutput,
    warning: string,
    error?: string
  ) {
    const result = validateMap(profileOutput, map);

    let message = '';
    let pass = true;
    let errors: ValidationIssue[] = [];
    let warnings: ValidationIssue[] = [];

    if (!result.pass) {
      errors = result.errors;
    }
    if (result.warnings && result.warnings.length > 0) {
      warnings = result.warnings;
    }

    if (this.isNot) {
      pass = false;

      if (!error) {
        pass = !pass;
        message = 'expected to fail';
      } else {
        const err = formatIssues(errors);
        const warn = formatIssues(warnings);

        if (!err.includes(error)) {
          pass = !pass;
          message = `expected to find error "${error}" in "${err}"`;
          if (warning !== '' && !warn.includes(warning)) {
            message += `, expected to find warning "${warning}" in "${warn}"`;
          }
        } else if (warning !== '' && !warn.includes(warning)) {
          pass = !pass;
          message = `expected to find warning "${warning}" in "${warn}"`;
        }
      }
    } else {
      const warn = formatIssues(warnings);
      const err = formatIssues(errors);
      if (errors.length > 0) {
        pass = !pass;
        message = `expected to pass, errors: ${err}, warnings: ${warn}`;
      } else if (warning && warning !== '' && !warn.includes(warning)) {
        pass = !pass;
        message = `expected to find warning "${warning}" in "${warn}"`;
      }
    }

    return {
      pass,
      message: (): string => message,
    };
  },
});

function valid(
  profile: ProfileDocumentNode,
  maps: MapASTNode[],
  ...warnings: string[]
): void {
  const profileOutput = getProfileOutput(profile);

  it('then validation will pass', () => {
    maps.forEach((map, index) => {
      expect(map).toBeValidMap(profileOutput, warnings[index]);
    });
  });
}

function invalid(
  profile: ProfileDocumentNode,
  maps: MapASTNode[],
  ...results: string[]
): void {
  const profileOutput = getProfileOutput(profile);

  it('then validation will fail', () => {
    let i = 0;
    maps.forEach(map => {
      expect(map).not.toBeValidMap(profileOutput, results[i + 1], results[i]);
      i += 2;
    });
  });
}

describe('MapValidator', () => {
  describe('result & error', () => {
    describe('result is PrimitiveTypeName', () => {
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',

        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',

            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'EnumDefinition',
                values: [
                  { kind: 'EnumValue', value: 'NOTFOUND' },
                  { kind: 'EnumValue', value: 'BADREQUEST' },
                ],
              },
            },
          },
        ],
      };
      const mapAst1: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                isError: false,
                terminateFlow: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'NOTFOUND',
                },
              },
              {
                kind: 'OutcomeStatement',
                isError: false,
                terminateFlow: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'BADREQUEST',
                },
              },
            ],
          },
        ],
      };
      const mapAst2: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                isError: false,
                terminateFlow: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'wrong',
                },
              },
            ],
          },
        ],
      };

      valid(profileAst, [mapAst1]);
      invalid(
        profileAst,
        [mapAst2],
        'PrimitiveLiteral - Wrong Structure: expected NOTFOUND or BADREQUEST, but got "wrong"',
        ''
      );
    });
    describe('error is PrimitiveTypeName', () => {
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            error: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'EnumDefinition',
                values: [
                  { kind: 'EnumValue', value: 'NOTFOUND' },
                  { kind: 'EnumValue', value: 'BADREQUEST' },
                ],
              },
            },
          },
        ],
      };
      const mapAst1: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                isError: true,
                terminateFlow: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'NOTFOUND',
                },
              },
              {
                kind: 'OutcomeStatement',
                isError: true,
                terminateFlow: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'BADREQUEST',
                },
              },
            ],
          },
        ],
      };
      const mapAst2: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                isError: true,
                terminateFlow: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'wrong',
                },
              },
            ],
          },
        ],
      };

      valid(profileAst, [mapAst1]);
      invalid(
        profileAst,
        [mapAst2],
        'PrimitiveLiteral - Wrong Structure: expected NOTFOUND or BADREQUEST, but got "wrong"',
        ''
      );
    });
    describe('result is an object', () => {
      describe('possibly null field f1', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
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
                      type: {
                        kind: 'PrimitiveTypeName',
                        name: 'string',
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['inner'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 2,
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
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, but got f1, f2\nObjectLiteral - Wrong Object Structure: expected f1, but got f1, f2\nObjectLiteral - Wrong Object Structure: expected f1, but got f2'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Wrong Structure: expected string, but got "ObjectLiteral"',
          ''
        );
      });
      describe('possibly null fields: f1, f2', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
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
                        name: 'number',
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: '["some", "key"]',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          '1:16 ArrayLiteralExpression - Wrong Structure: expected string, but got "["some", "key"]"',
          ''
        );
      });
      describe('non null field f1', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
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
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: '["some", "key"]',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, but got f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          '1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected string, but got "["some", "key"]"\n1:16 ArrayLiteralExpression - Wrong Structure: expected string, but got "["some", "key"]"',
          ''
        );
      });
      describe('fields: f1, f2, where f2 is non null', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
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
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'number',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'JessieExpression - Wrong Structure: expected number, but got "null"\n1:5 NullKeyword - Wrong Structure: expected number, but got "null"\nJessieExpression - Wrong Structure: expected number, but got "null"\n1:5 NullKeyword - Wrong Structure: expected number, but got "null"',
          ''
        );
      });
      describe('non null fields: f1, f2', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
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
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                    },
                    {
                      kind: 'FieldDefinition',
                      required: false,
                      fieldName: 'f2',
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'number',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'JessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected number, but got "null"\n1:5 NullKeyword - Wrong Structure: expected number, but got "null"',
          ''
        );
      });
      describe('one required field: f1', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
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
                      required: true,
                      fieldName: 'f1',
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, but got f1, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"',
          ''
        );
      });
      describe('one required and one not required field: f1, f2', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
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
                      required: true,
                      fieldName: 'f1',
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                    },
                    {
                      kind: 'FieldDefinition',
                      required: false,
                      fieldName: 'f2',
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'boolean',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: true,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: false,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: true,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field',
          ''
        );
      });
      describe('required fields: f1, f2', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
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
                      required: true,
                      fieldName: 'f1',
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                    },
                    {
                      kind: 'FieldDefinition',
                      required: true,
                      fieldName: 'f2',
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'boolean',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: true,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: true,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: true,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Missing required field\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field\nObjectLiteral - Missing required field',
          ''
        );
      });
      describe('non null object with two required fields f1, f2', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',

              result: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'NonNullDefinition',
                  type: {
                    kind: 'ObjectDefinition',
                    fields: [
                      {
                        kind: 'FieldDefinition',
                        required: true,
                        fieldName: 'f1',
                        type: {
                          kind: 'NonNullDefinition',
                          type: {
                            kind: 'PrimitiveTypeName',
                            name: 'string',
                          },
                        },
                      },
                      {
                        kind: 'FieldDefinition',
                        required: true,
                        fieldName: 'f2',
                        type: {
                          kind: 'NonNullDefinition',
                          type: {
                            kind: 'PrimitiveTypeName',
                            name: 'number',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'null',
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1],
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst2, mapAst3],
          'MapDefinition - Result not defined',
          '',
          'ObjectLiteral - Missing required field\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nObjectLiteral - Missing required field\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected ObjectStructure, but got "null"\n1:5 NullKeyword - Wrong Structure: expected ObjectStructure, but got "null"',
          ''
        );
      });
      describe('that uses dot.notation for fields', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
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
                      type: {
                        kind: 'ObjectDefinition',
                        fields: [
                          {
                            kind: 'FieldDefinition',
                            required: false,
                            fieldName: 'f2',
                            type: {
                              kind: 'ObjectDefinition',
                              fields: [
                                {
                                  kind: 'FieldDefinition',
                                  required: false,
                                  fieldName: 'inner',
                                  type: {
                                    kind: 'PrimitiveTypeName',
                                    name: 'number',
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                    {
                      kind: 'FieldDefinition',
                      required: false,
                      fieldName: 'f2',
                      type: {
                        kind: 'PrimitiveTypeName',
                        name: 'number',
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1', 'f2', 'inner'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 1,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['f2', 'inner'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 1,
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['f2'],
                              value: {
                                kind: 'ObjectLiteral',
                                fields: [
                                  {
                                    kind: 'Assignment',
                                    key: ['inner'],
                                    value: {
                                      kind: 'PrimitiveLiteral',
                                      value: 1,
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1', 'f2', 'inner'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 1,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2', 'f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1', 'f2.inner'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 1,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2', 'f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1', 'f2', 'inner'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 1,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['f1'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 2,
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
          ],
        };

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          'ObjectLiteral - Wrong Structure: expected number, but got "ObjectLiteral"\nObjectLiteral - Wrong Structure: expected number, but got "ObjectLiteral"\nObjectLiteral - Wrong Structure: expected number, but got "ObjectLiteral"',
          ''
        );
      });
    });
    describe('error is an object', () => {
      describe('possibly null field f1', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              error: {
                kind: 'UseCaseSlotDefinition',
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
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['inner'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 2,
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
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, but got f1, f2\nObjectLiteral - Wrong Object Structure: expected f1, but got f1, f2\nObjectLiteral - Wrong Object Structure: expected f1, but got f2'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Wrong Structure: expected string, but got "ObjectLiteral"',
          ''
        );
      });
      describe('possibly null fields: f1, f2', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',

              error: {
                kind: 'UseCaseSlotDefinition',
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
                        name: 'number',
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: '["some", "key"]',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          '1:16 ArrayLiteralExpression - Wrong Structure: expected string, but got "["some", "key"]"',
          ''
        );
      });
      describe('non null field f1', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',

              error: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ObjectDefinition',
                  fields: [
                    {
                      kind: 'FieldDefinition',
                      required: false,
                      fieldName: 'f1',
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: '["some", "key"]',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, but got f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          '1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected string, but got "["some", "key"]"\n1:16 ArrayLiteralExpression - Wrong Structure: expected string, but got "["some", "key"]"',
          ''
        );
      });
      describe('fields: f1, f2, where f2 is non null', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',

              error: {
                kind: 'UseCaseSlotDefinition',
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
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'number',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'JessieExpression - Wrong Structure: expected number, but got "null"\n1:5 NullKeyword - Wrong Structure: expected number, but got "null"\nJessieExpression - Wrong Structure: expected number, but got "null"\n1:5 NullKeyword - Wrong Structure: expected number, but got "null"',
          ''
        );
      });
      describe('non null fields: f1, f2', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',

              error: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ObjectDefinition',
                  fields: [
                    {
                      kind: 'FieldDefinition',
                      required: false,
                      fieldName: 'f1',
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                    },
                    {
                      kind: 'FieldDefinition',
                      required: false,
                      fieldName: 'f2',
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'number',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'JessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected number, but got "null"\n1:5 NullKeyword - Wrong Structure: expected number, but got "null"',
          ''
        );
      });
      describe('one required field: f1', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              error: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ObjectDefinition',
                  fields: [
                    {
                      kind: 'FieldDefinition',
                      required: true,
                      fieldName: 'f1',
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, but got f1, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"',
          ''
        );
      });
      describe('one required and one not required field: f1, f2', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',

              error: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ObjectDefinition',
                  fields: [
                    {
                      kind: 'FieldDefinition',
                      required: true,
                      fieldName: 'f1',
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                    },
                    {
                      kind: 'FieldDefinition',
                      required: false,
                      fieldName: 'f2',
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'boolean',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: true,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: false,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: true,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f3\nObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field',
          ''
        );
      });
      describe('required fields: f1, f2', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',

              error: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ObjectDefinition',
                  fields: [
                    {
                      kind: 'FieldDefinition',
                      required: true,
                      fieldName: 'f1',
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                    },
                    {
                      kind: 'FieldDefinition',
                      required: true,
                      fieldName: 'f2',
                      type: {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'boolean',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: true,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: true,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: true,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1, mapAst2],
          '',
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst3],
          'ObjectLiteral - Missing required field\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nJessieExpression - Wrong Structure: expected boolean, but got "null"\n1:5 NullKeyword - Wrong Structure: expected boolean, but got "null"\nObjectLiteral - Missing required field\nObjectLiteral - Missing required field',
          ''
        );
      });
      describe('non null object with two required fields f1, f2', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',

              error: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'NonNullDefinition',
                  type: {
                    kind: 'ObjectDefinition',
                    fields: [
                      {
                        kind: 'FieldDefinition',
                        required: true,
                        fieldName: 'f1',
                        type: {
                          kind: 'NonNullDefinition',
                          type: {
                            kind: 'PrimitiveTypeName',
                            name: 'string',
                          },
                        },
                      },
                      {
                        kind: 'FieldDefinition',
                        required: true,
                        fieldName: 'f2',
                        type: {
                          kind: 'NonNullDefinition',
                          type: {
                            kind: 'PrimitiveTypeName',
                            name: 'number',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f2'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2,
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['f3'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 3,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'null',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['f1'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'some string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'null',
                  },
                },
              ],
            },
          ],
        };

        valid(
          profileAst,
          [mapAst1],
          'ObjectLiteral - Wrong Object Structure: expected f1, f2, but got f1, f2, f3'
        );
        invalid(
          profileAst,
          [mapAst2, mapAst3],
          'MapDefinition - Error not defined',
          '',
          'ObjectLiteral - Missing required field\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected string, but got "null"\n1:5 NullKeyword - Wrong Structure: expected string, but got "null"\nObjectLiteral - Missing required field\nObjectLiteral - Missing required field\nJessieExpression - Wrong Structure: expected ObjectStructure, but got "null"\n1:5 NullKeyword - Wrong Structure: expected ObjectStructure, but got "null"',
          ''
        );
      });
    });
    describe('result is a list', () => {
      describe('primitive type', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              result: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ListDefinition',
                  elementType: {
                    kind: 'PrimitiveTypeName',
                    name: 'boolean',
                  },
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[null]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, false]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[2]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[{}]',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '2:3 FirstLiteralToken - Wrong Structure: expected boolean, but got "2"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[{}]"\n2:4 ObjectLiteralExpression - Wrong Structure: expected boolean, but got "{}"',
          ''
        );
      });
      describe('primitive or object type', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              result: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ListDefinition',
                  elementType: {
                    kind: 'UnionDefinition',
                    types: [
                      { kind: 'PrimitiveTypeName', name: 'boolean' },
                      { kind: 'ObjectDefinition', fields: [] },
                    ],
                  },
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[null]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, false]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[{}, {}]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, {}]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression:
                      '[true, false, true, false, {}, true, {}, true, {}]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[2]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[[true]]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2, {}]',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '1:4 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"',
          ''
        );
      });
      describe('non null primitive type or possibly null object type', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              result: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ListDefinition',
                  elementType: {
                    kind: 'UnionDefinition',
                    types: [
                      {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'boolean',
                        },
                      },
                      { kind: 'ObjectDefinition', fields: [] },
                    ],
                  },
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[null]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, {}]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2, {}]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[[true]]',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '1:10 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"',
          ''
        );
      });
      describe('non null primitive type', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              result: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ListDefinition',
                  elementType: {
                    kind: 'NonNullDefinition',
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'boolean',
                    },
                  },
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[null]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[{}]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, {}]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[[true]]',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '2:6 NullKeyword - Wrong Structure: expected boolean, but got "null"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[{}]"\n2:4 ObjectLiteralExpression - Wrong Structure: expected boolean, but got "{}"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, {}]"\n8:10 ObjectLiteralExpression - Wrong Structure: expected boolean, but got "{}"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\n8:9 FirstLiteralToken - Wrong Structure: expected boolean, but got "2"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n2:8 ArrayLiteralExpression - Wrong Structure: expected boolean, but got "[true]"',
          ''
        );
      });
      describe('non null primitive or object type', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              result: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ListDefinition',
                  elementType: {
                    kind: 'UnionDefinition',
                    types: [
                      {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'boolean',
                        },
                      },
                      {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'ObjectDefinition',
                          fields: [],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, {}]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[null]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[undefined]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2, {}]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[[true]]',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '1:7 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[null]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[undefined]"\n1:12 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[undefined]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\n1:10 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"',
          ''
        );
      });
      describe('non null list with primitive or object type', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              result: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'NonNullDefinition',
                  type: {
                    kind: 'ListDefinition',
                    elementType: {
                      kind: 'UnionDefinition',
                      types: [
                        {
                          kind: 'PrimitiveTypeName',
                          name: 'boolean',
                        },
                        {
                          kind: 'ObjectDefinition',
                          fields: [],
                        },
                      ],
                    },
                  },
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[null]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, {}]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst4: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2, {}]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[[true]]',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3, mapAst4],
          'MapDefinition - Result not defined',
          '',
          'ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"',
          ''
        );
      });
    });
    describe('error is a list', () => {
      describe('primitive type', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              error: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ListDefinition',
                  elementType: {
                    kind: 'PrimitiveTypeName',
                    name: 'boolean',
                  },
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[null]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, false]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[2]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[{}]',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '2:3 FirstLiteralToken - Wrong Structure: expected boolean, but got "2"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[{}]"\n2:4 ObjectLiteralExpression - Wrong Structure: expected boolean, but got "{}"',
          ''
        );
      });
      describe('primitive or object type', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              error: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ListDefinition',
                  elementType: {
                    kind: 'UnionDefinition',
                    types: [
                      { kind: 'PrimitiveTypeName', name: 'boolean' },
                      { kind: 'ObjectDefinition', fields: [] },
                    ],
                  },
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[null]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, false]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[{}, {}]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, {}]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression:
                      '[true, false, true, false, {}, true, {}, true, {}]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[2]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[[true]]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2, {}]',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '1:4 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"',
          ''
        );
      });
      describe('non null primitive type or possibly null object type', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              error: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ListDefinition',
                  elementType: {
                    kind: 'UnionDefinition',
                    types: [
                      {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'boolean',
                        },
                      },
                      { kind: 'ObjectDefinition', fields: [] },
                    ],
                  },
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[null]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, {}]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2, {}]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[[true]]',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '1:10 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"',
          ''
        );
      });
      describe('non null primitive type', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              error: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ListDefinition',
                  elementType: {
                    kind: 'NonNullDefinition',
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'boolean',
                    },
                  },
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[null]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[{}]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, {}]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[[true]]',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '2:6 NullKeyword - Wrong Structure: expected boolean, but got "null"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[{}]"\n2:4 ObjectLiteralExpression - Wrong Structure: expected boolean, but got "{}"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, {}]"\n8:10 ObjectLiteralExpression - Wrong Structure: expected boolean, but got "{}"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\n8:9 FirstLiteralToken - Wrong Structure: expected boolean, but got "2"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n2:8 ArrayLiteralExpression - Wrong Structure: expected boolean, but got "[true]"',
          ''
        );
      });
      describe('non null primitive or object type', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              error: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'ListDefinition',
                  elementType: {
                    kind: 'UnionDefinition',
                    types: [
                      {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'boolean',
                        },
                      },
                      {
                        kind: 'NonNullDefinition',
                        type: {
                          kind: 'ObjectDefinition',
                          fields: [],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, {}]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[null]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[undefined]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2, {}]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[[true]]',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          '1:7 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[null]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[undefined]"\n1:12 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[undefined]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\n1:10 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"',
          ''
        );
      });
      describe('non null list with primitive or object type', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              error: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'NonNullDefinition',
                  type: {
                    kind: 'ListDefinition',
                    elementType: {
                      kind: 'UnionDefinition',
                      types: [
                        {
                          kind: 'PrimitiveTypeName',
                          name: 'boolean',
                        },
                        {
                          kind: 'ObjectDefinition',
                          fields: [],
                        },
                      ],
                    },
                  },
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[null]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, {}]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [],
            },
          ],
        };
        const mapAst4: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[true, 2, {}]',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '[[true]]',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3, mapAst4],
          'MapDefinition - Error not defined',
          '',
          'ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\n1:14 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[true, 2, {}]"\nJessieExpression - Wrong Structure: expected ListStructure, but got "[[true]]"\n1:9 ArrayLiteralExpression - Wrong Structure: expected ListStructure, but got "[[true]]"',
          ''
        );
      });
    });
    describe('result is a jessie script', () => {
      describe('object', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
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
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: "{\n\tf1: 'some string',\n\tf2: true\r\n}",
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression:
                      'body.map(function (val) { return val.toUpperCase(); })',
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: "['some string', true]",
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          '1:22 ArrayLiteralExpression - Wrong Structure: expected ObjectStructure, but got "[\'some string\', true]"',
          ''
        );
      });
      describe('array', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
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
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: "['some string', true]",
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: "Array('some string', true)",
                  },
                },
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a'],
                      value: {
                        kind: 'JessieExpression',
                        expression: '["hello", "world"]',
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression:
                      'readArrays = (this && this.__spreadArrays) || function () {\r\n    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;\r\n    for (var r = Array(s), k = 0, i = 0; i < il; i++)\r\n        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)\r\n            r[k] = a[j];\r\n    return r;\r\n};\r\nvar x = __spreadArrays(a.map(function (val) { return val.toUpperCase(); }))',
                    source: '[...a.map(val => val.toUpperCase())]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a'],
                      value: {
                        kind: 'JessieExpression',
                        expression: '["hello", "world"]',
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression:
                      'sign = (this && this.__assign) || function () {\n\t__assign = Object.assign || function(t) {\n\t    for (var s, i = 1, n = arguments.length; i < n; i++) {\n\t        s = arguments[i];\n\t        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))\n\t            t[p] = s[p];\n\t    }\n\t    return t;\n\t};\n\treturn __assign.apply(this, arguments);\r\n};\r\nvar x = __assign({}, a.map(function (val) { return val.toUpperCase(); }))',
                    source: '{...a.map(val => val.toUpperCase())}',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: "{\n\tf1: 'some string',\n\tf2: true\n}",
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          'JessieExpression - Wrong Structure: expected ListStructure, but got "{...a.map(val => val.toUpperCase())}"\n1:37 ObjectLiteralExpression - Wrong Structure: expected ListStructure, but got "{...a.map(val => val.toUpperCase())}"\nJessieExpression - Wrong Structure: expected ListStructure, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"\n1:34 ObjectLiteralExpression - Wrong Structure: expected ListStructure, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"',
          ''
        );
      });
      describe('primitive type', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
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
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: "'string' + true'",
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '1+"true"',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '"some " + "string"',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'String(24)',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: "['some ', 'string'].join('')",
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '`some ${var}`',
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: "['some string', true]",
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: "{\n\tf1: 'some string',\n\tf2: true\n}",
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'true',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'false',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '2+25',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          '1:22 ArrayLiteralExpression - Wrong Structure: expected string, but got "[\'some string\', true]"\nJessieExpression - Wrong Structure: expected string, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"\n1:34 ObjectLiteralExpression - Wrong Structure: expected string, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"\nJessieExpression - Wrong Structure: expected string, but got "true"\n1:5 TrueKeyword - Wrong Structure: expected string, but got "true"\nJessieExpression - Wrong Structure: expected string, but got "false"\n1:6 FalseKeyword - Wrong Structure: expected string, but got "false"\nJessieExpression - Wrong Structure: expected string, but got "2+25"',
          ''
        );
      });
    });
    describe('error is a jessie script', () => {
      describe('object', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              error: {
                kind: 'UseCaseSlotDefinition',
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
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: "{\n\tf1: 'some string',\n\tf2: true\r\n}",
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression:
                      'body.map(function (val) { return val.toUpperCase(); })',
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: "['some string', true]",
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          '1:22 ArrayLiteralExpression - Wrong Structure: expected ObjectStructure, but got "[\'some string\', true]"',
          ''
        );
      });
      describe('array', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              error: {
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
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: "['some string', true]",
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: "Array('some string', true)",
                  },
                },
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a'],
                      value: {
                        kind: 'JessieExpression',
                        expression: '["hello", "world"]',
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression:
                      'readArrays = (this && this.__spreadArrays) || function () {\r\n    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;\r\n    for (var r = Array(s), k = 0, i = 0; i < il; i++)\r\n        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)\r\n            r[k] = a[j];\r\n    return r;\r\n};\r\nvar x = __spreadArrays(a.map(function (val) { return val.toUpperCase(); }))',
                    source: '[...a.map(val => val.toUpperCase())]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a'],
                      value: {
                        kind: 'JessieExpression',
                        expression: '["hello", "world"]',
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression:
                      'sign = (this && this.__assign) || function () {\n\t__assign = Object.assign || function(t) {\n\t    for (var s, i = 1, n = arguments.length; i < n; i++) {\n\t        s = arguments[i];\n\t        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))\n\t            t[p] = s[p];\n\t    }\n\t    return t;\n\t};\n\treturn __assign.apply(this, arguments);\r\n};\r\nvar x = __assign({}, a.map(function (val) { return val.toUpperCase(); }))',
                    source: '{...a.map(val => val.toUpperCase())}',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: "{\n\tf1: 'some string',\n\tf2: true\n}",
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          'JessieExpression - Wrong Structure: expected ListStructure, but got "{...a.map(val => val.toUpperCase())}"\n1:37 ObjectLiteralExpression - Wrong Structure: expected ListStructure, but got "{...a.map(val => val.toUpperCase())}"\nJessieExpression - Wrong Structure: expected ListStructure, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"\n1:34 ObjectLiteralExpression - Wrong Structure: expected ListStructure, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"',
          ''
        );
      });
      describe('primitive type', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
              error: {
                kind: 'UseCaseSlotDefinition',
                type: {
                  kind: 'PrimitiveTypeName',
                  name: 'string',
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: "'string' + true'",
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '1+"true"',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '"some " + "string"',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'String(24)',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: "['some ', 'string'].join('')",
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '`some ${var}`',
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: "['some string', true]",
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: "{\n\tf1: 'some string',\n\tf2: true\n}",
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'true',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'false',
                  },
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: true,
                  value: {
                    kind: 'JessieExpression',
                    expression: '2+25',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          '1:22 ArrayLiteralExpression - Wrong Structure: expected string, but got "[\'some string\', true]"\nJessieExpression - Wrong Structure: expected string, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"\n1:34 ObjectLiteralExpression - Wrong Structure: expected string, but got "{\n\tf1: \'some string\',\n\tf2: true\n}"\nJessieExpression - Wrong Structure: expected string, but got "true"\n1:5 TrueKeyword - Wrong Structure: expected string, but got "true"\nJessieExpression - Wrong Structure: expected string, but got "false"\n1:6 FalseKeyword - Wrong Structure: expected string, but got "false"\nJessieExpression - Wrong Structure: expected string, but got "2+25"',
          ''
        );
      });
    });
    describe('result is variable', () => {
      describe('referenced in outcome', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
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
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a', 'c'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'string',
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'a.c',
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a', 'c'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'string',
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'a',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          'JessieExpression - Wrong Variable Structure: variable a expected string, but got ObjectLiteral',
          ''
        );
      });
      describe('reassigned (object)', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
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
                      fieldName: 'f1',
                      required: false,
                      type: {
                        kind: 'PrimitiveTypeName',
                        name: 'string',
                      },
                    },
                    {
                      kind: 'FieldDefinition',
                      fieldName: 'f2',
                      required: false,
                      type: {
                        kind: 'PrimitiveTypeName',
                        name: 'boolean',
                      },
                    },
                  ],
                },
              },
            },
          ],
        };
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['foo'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'string',
                      },
                    },
                  ],
                },
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['foo', 'f1'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'string',
                      },
                    },
                  ],
                },
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['foo', 'f2'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: false,
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'foo',
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['foo', 'f1'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'string',
                      },
                    },
                  ],
                },
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['foo', 'f2'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: false,
                      },
                    },
                  ],
                },
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['foo'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'string',
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'foo',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1]);
        invalid(
          profileAst,
          [mapAst2],
          'JessieExpression - Wrong Variable Structure: variable foo expected ObjectStructure, but got string',
          ''
        );
      });
      describe('reassigned (string)', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
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
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: false,
                      },
                    },
                  ],
                },
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a', 'b'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'some string',
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'a.b',
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a', 'b'],
                      value: {
                        kind: 'JessieExpression',
                        expression: '[1, 2, 3]',
                      },
                    },
                  ],
                },
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a', 'b'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'some string',
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'a.b',
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a', 'b'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'some string',
                      },
                    },
                  ],
                },
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: false,
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'a',
                  },
                },
              ],
            },
          ],
        };
        const mapAst4: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a', 'b'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'some string',
                      },
                    },
                  ],
                },
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a', 'b'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: false,
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'a.b',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3, mapAst4],
          'JessieExpression - Wrong Variable Structure: variable a expected string, but got false',
          '',
          'JessieExpression - Wrong Variable Structure: variable a.b expected string, but got false',
          ''
        );
      });
      describe('using variable with string key', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
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
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['foo.bar', 'a'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'some string',
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '"foo.bar".a',
                  },
                },
              ],
            },
          ],
        };
        const mapAst2: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['foo.bar', 'a'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'some string',
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '"foo.bar".a',
                  },
                },
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['foo', 'bar.a'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'some string',
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'foo["bar.a"]',
                  },
                },
              ],
            },
          ],
        };
        const mapAst3: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['foo.bar', 'a'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: false,
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: '"foo.bar".a',
                  },
                },
              ],
            },
          ],
        };

        valid(profileAst, [mapAst1, mapAst2]);
        invalid(
          profileAst,
          [mapAst3],
          'JessieExpression - Wrong Variable Structure: variable foo.bar.a expected string, but got false',
          ''
        );
      });
      describe('wrong structure', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
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
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a', 'b'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: false,
                      },
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'a.b',
                  },
                },
              ],
            },
          ],
        };

        invalid(
          profileAst,
          [mapAst1],
          'JessieExpression - Wrong Variable Structure: variable a.b expected string, but got false',
          ''
        );
      });
      describe('in different scopes', () => {
        const profileAst: ProfileDocumentNode = {
          kind: 'ProfileDocument',

          header: profileHeader,
          definitions: [
            {
              kind: 'UseCaseDefinition',
              useCaseName: 'Test',
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
        const mapAst1: MapASTNode = {
          kind: 'MapDocument',
          header: mapHeader,
          definitions: [
            {
              kind: 'MapDefinition',
              name: 'Test',
              usecaseName: 'Test',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['a', 'c'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: false,
                      },
                    },
                  ],
                },
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['b'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'some string',
                      },
                    },
                  ],
                },
                {
                  kind: 'HttpCallStatement',
                  method: 'GET',
                  url: 'http://example.com/',
                  responseHandlers: [
                    {
                      kind: 'HttpResponseHandler',
                      statements: [
                        {
                          kind: 'SetStatement',
                          assignments: [
                            {
                              kind: 'Assignment',
                              key: ['a', 'c'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'some string',
                              },
                            },
                          ],
                        },
                        {
                          kind: 'SetStatement',
                          assignments: [
                            {
                              kind: 'Assignment',
                              key: ['c'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'some string',
                              },
                            },
                          ],
                        },
                        {
                          kind: 'OutcomeStatement',
                          terminateFlow: false,
                          isError: false,
                          value: {
                            kind: 'JessieExpression',
                            expression: 'a.c',
                          },
                        },
                        {
                          kind: 'OutcomeStatement',
                          terminateFlow: false,
                          isError: false,
                          value: {
                            kind: 'JessieExpression',
                            expression: 'b',
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  kind: 'OutcomeStatement',
                  terminateFlow: false,
                  isError: false,
                  value: {
                    kind: 'JessieExpression',
                    expression: 'a.c',
                  },
                },
              ],
            },
          ],
        };

        invalid(
          profileAst,
          [mapAst1],
          'JessieExpression - Wrong Variable Structure: variable a.c expected string, but got false',
          ''
        );
      });
    });
    describe('result is conditioned', () => {
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',

        header: profileHeader,
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
                    type: {
                      kind: 'ObjectDefinition',
                      fields: [
                        {
                          kind: 'FieldDefinition',
                          fieldName: 'inner',
                          required: false,
                          type: {
                            kind: 'PrimitiveTypeName',
                            name: 'string',
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
      const mapAst: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                condition: {
                  kind: 'ConditionAtom',
                  expression: {
                    kind: 'JessieExpression',
                    expression: 'cond',
                  },
                },
                value: {
                  kind: 'ObjectLiteral',
                  fields: [
                    {
                      kind: 'Assignment',
                      key: ['f1'],
                      value: {
                        kind: 'ObjectLiteral',
                        fields: [
                          {
                            kind: 'Assignment',
                            key: ['inner'],
                            value: {
                              kind: 'ObjectLiteral',
                              fields: [],
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
        ],
      };

      valid(
        profileAst,
        [mapAst],
        'ObjectLiteral - Wrong Structure: expected string, but got "ObjectLiteral"'
      );
    });
    describe('error is conditioned', () => {
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',

        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            error: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    required: false,
                    fieldName: 'f1',
                    type: {
                      kind: 'ObjectDefinition',
                      fields: [
                        {
                          kind: 'FieldDefinition',
                          fieldName: 'inner',
                          required: false,
                          type: {
                            kind: 'PrimitiveTypeName',
                            name: 'string',
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
      const mapAst: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: true,
                condition: {
                  kind: 'ConditionAtom',
                  expression: {
                    kind: 'JessieExpression',
                    expression: 'cond',
                  },
                },
                value: {
                  kind: 'ObjectLiteral',
                  fields: [
                    {
                      kind: 'Assignment',
                      key: ['f1'],
                      value: {
                        kind: 'ObjectLiteral',
                        fields: [
                          {
                            kind: 'Assignment',
                            key: ['inner'],
                            value: {
                              kind: 'ObjectLiteral',
                              fields: [],
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: true,
                condition: {
                  kind: 'ConditionAtom',
                  expression: {
                    kind: 'JessieExpression',
                    expression: 'cond',
                  },
                },
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'some string',
                },
              },
            ],
          },
        ],
      };

      valid(
        profileAst,
        [mapAst],
        'ObjectLiteral - Wrong Structure: expected string, but got "ObjectLiteral"\nPrimitiveLiteral - Wrong Structure: expected ObjectStructure, but got "some string"'
      );
    });
    describe('map is using http call', () => {
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',

        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    required: false,
                    fieldName: 'to',
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'string',
                    },
                  },
                  {
                    kind: 'FieldDefinition',
                    required: false,
                    fieldName: 'from',
                  },
                ],
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
                    fieldName: 'from',
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'string',
                    },
                  },
                  {
                    kind: 'FieldDefinition',
                    required: false,
                    fieldName: 'text',
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'string',
                    },
                  },
                ],
              },
            },
          },
        ],
      };
      const mapAst1: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'SetStatement',
                assignments: [
                  {
                    kind: 'Assignment',
                    key: ['some', 'variable'],
                    value: {
                      kind: 'PrimitiveLiteral',
                      value: 'string',
                    },
                  },
                ],
              },
              {
                kind: 'HttpCallStatement',
                method: 'POST',
                url: 'http://example.com/{some.variable}/{input.from}',
                responseHandlers: [
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: false,
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['from'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'some string',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['text'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'some string',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const mapAst2: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'HttpCallStatement',
                method: 'POST',
                url: 'http://www.example.com/',
                responseHandlers: [
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: false,
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['from'],
                              value: {
                                kind: 'ObjectLiteral',
                                fields: [],
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['text'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'some string',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      valid(
        profileAst,
        [mapAst1],
        'HttpCallStatement - Wrong Structure: expected string, but got "ScalarStructure"'
      );
      invalid(
        profileAst,
        [mapAst2],
        'ObjectLiteral - Wrong Structure: expected string, but got "ObjectLiteral"',
        ''
      );
    });
    describe('map is using inline call', () => {
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',

        header: profileHeader,
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
                    fieldName: 'from',
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'string',
                    },
                  },
                  {
                    kind: 'FieldDefinition',
                    required: false,
                    fieldName: 'text',
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'string',
                    },
                  },
                ],
              },
            },
          },
        ],
      };
      const mapAst1: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'OperationDefinition',
            name: 'Foo',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'some string',
                },
              },
            ],
          },
          {
            kind: 'OperationDefinition',
            name: 'Bar',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'some string',
                },
              },
            ],
          },
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                value: {
                  kind: 'ObjectLiteral',
                  fields: [
                    {
                      kind: 'Assignment',
                      key: ['from'],
                      value: {
                        kind: 'InlineCall',
                        operationName: 'Foo',
                        arguments: [],
                      },
                    },
                    {
                      kind: 'Assignment',
                      key: ['text'],
                      value: {
                        kind: 'InlineCall',
                        operationName: 'Bar',
                        arguments: [],
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const mapAst2: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'OperationDefinition',
            name: 'Foo',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'some string',
                },
              },
            ],
          },
          {
            kind: 'OperationDefinition',
            name: 'Bar',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                value: {
                  kind: 'ObjectLiteral',
                  fields: [],
                },
              },
            ],
          },
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                value: {
                  kind: 'ObjectLiteral',
                  fields: [
                    {
                      kind: 'Assignment',
                      key: ['from'],
                      value: {
                        kind: 'InlineCall',
                        operationName: 'Foo',
                        arguments: [],
                      },
                    },
                    {
                      kind: 'Assignment',
                      key: ['text'],
                      value: {
                        kind: 'InlineCall',
                        operationName: 'Bar',
                        arguments: [],
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      valid(profileAst, [mapAst1, mapAst2]);
    });
  });

  describe('input', () => {
    const profileAst: ProfileDocumentNode = {
      kind: 'ProfileDocument',
      header: profileHeader,
      definitions: [
        {
          kind: 'UseCaseDefinition',
          useCaseName: 'Test',
          input: {
            kind: 'UseCaseSlotDefinition',
            type: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  required: false,
                  fieldName: 'person',
                  type: {
                    kind: 'ObjectDefinition',
                    fields: [
                      {
                        kind: 'FieldDefinition',
                        required: false,
                        fieldName: 'from',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                      {
                        kind: 'FieldDefinition',
                        required: false,
                        fieldName: 'to',
                        type: {
                          kind: 'PrimitiveTypeName',
                          name: 'string',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'FieldDefinition',
                  required: false,
                  fieldName: 'to',
                  type: {
                    kind: 'PrimitiveTypeName',
                    name: 'string',
                  },
                },
                {
                  kind: 'FieldDefinition',
                  required: false,
                  fieldName: 'from',
                  type: {
                    kind: 'PrimitiveTypeName',
                    name: 'string',
                  },
                },
                {
                  kind: 'FieldDefinition',
                  required: false,
                  fieldName: 'text',
                  type: {
                    kind: 'PrimitiveTypeName',
                    name: 'string',
                  },
                },
              ],
            },
          },
        },
      ],
    };
    describe('input referenced in HttpCallStatement', () => {
      const mapAst1: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'HttpCallStatement',
                method: 'POST',
                url: 'http://www.example.com/',
                request: {
                  kind: 'HttpRequest',
                  body: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['to'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.to',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['sms', 'from'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.from',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['sms', 'text'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.text',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['to', 'person'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.person.to',
                        },
                      },
                    ],
                  },
                  security: [],
                },
                responseHandlers: [
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: false,
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'OK',
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const mapAst2: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'HttpCallStatement',
                method: 'POST',
                url: 'http://www.example.com/',
                request: {
                  kind: 'HttpRequest',
                  body: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['to'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.wrong',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['sms', 'from'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.from',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['sms', 'text'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.text',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['to', 'person'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.person.wrong',
                        },
                      },
                    ],
                  },
                  security: [],
                },
                responseHandlers: [
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: false,
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'OK',
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      valid(profileAst, [mapAst1]);
      invalid(
        profileAst,
        [mapAst2],
        'JessieExpression - Wrong Input Structure: expected person, to, from, text, but got input.wrong\n1:12 PropertyAccessExpression - Wrong Input Structure: expected person, to, from, text, but got input.wrong',
        ''
      );
    });
    describe('input referenced in SetStatement', () => {
      const mapAst1: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'SetStatement',
                assignments: [
                  {
                    kind: 'Assignment',
                    key: ['a'],
                    value: {
                      kind: 'JessieExpression',
                      expression: 'input.from',
                    },
                  },
                  {
                    kind: 'Assignment',
                    key: ['b'],
                    value: {
                      kind: 'JessieExpression',
                      expression: 'input.person.from',
                    },
                  },
                ],
              },
            ],
          },
        ],
      };
      const mapAst2: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'SetStatement',
                assignments: [
                  {
                    kind: 'Assignment',
                    key: ['a'],
                    value: {
                      kind: 'JessieExpression',
                      expression: 'input.wrong',
                    },
                  },
                  {
                    kind: 'Assignment',
                    key: ['b'],
                    value: {
                      kind: 'JessieExpression',
                      expression: 'input.person.wrong',
                    },
                  },
                ],
              },
            ],
          },
        ],
      };

      valid(profileAst, [mapAst1]);
      invalid(
        profileAst,
        [mapAst2],
        '1:12 PropertyAccessExpression - Wrong Input Structure: expected person, to, from, text, but got input.wrong',
        ''
      );
    });
    describe('input referenced in ConditionAtomNode', () => {
      const mapAst1: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'SetStatement',
                condition: {
                  kind: 'ConditionAtom',
                  expression: {
                    kind: 'JessieExpression',
                    expression: 'input.person',
                  },
                },
                assignments: [
                  {
                    kind: 'Assignment',
                    key: ['a'],
                    value: {
                      kind: 'JessieExpression',
                      expression: '25 + 10',
                    },
                  },
                ],
              },
              {
                kind: 'OutcomeStatement',
                isError: false,
                terminateFlow: false,
                value: {
                  kind: 'JessieExpression',
                  expression: 'input.person.from',
                },
              },
            ],
          },
        ],
      };
      const mapAst2: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'SetStatement',
                condition: {
                  kind: 'ConditionAtom',
                  expression: {
                    kind: 'JessieExpression',
                    expression: 'input.wrong',
                  },
                },
                assignments: [
                  {
                    kind: 'Assignment',
                    key: ['a'],
                    value: {
                      kind: 'JessieExpression',
                      expression: '25 + 10',
                    },
                  },
                ],
              },
              {
                kind: 'OutcomeStatement',
                isError: false,
                terminateFlow: false,
                value: {
                  kind: 'JessieExpression',
                  expression: 'input.person.wrong',
                },
              },
            ],
          },
        ],
      };

      valid(profileAst, [mapAst1]);
      invalid(
        profileAst,
        [mapAst2],
        'JessieExpression - Wrong Input Structure: expected person, to, from, text, but got input.person.wrong\n1:19 PropertyAccessExpression - Wrong Input Structure: expected person, to, from, text, but got input.person.wrong',
        ''
      );
    });
    describe('input referenced in arguments of CallStatement', () => {
      const mapAst1: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'OperationDefinition',
            name: 'Foo',
            statements: [],
          },
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'CallStatement',
                operationName: 'Foo',
                arguments: [
                  {
                    kind: 'Assignment',
                    key: ['from', 'person'],
                    value: {
                      kind: 'JessieExpression',
                      expression: 'input.person.from',
                    },
                  },
                  {
                    kind: 'Assignment',
                    key: ['to', 'person'],
                    value: {
                      kind: 'JessieExpression',
                      expression: 'input.person.to',
                    },
                  },
                  {
                    kind: 'Assignment',
                    key: ['message'],
                    value: {
                      kind: 'JessieExpression',
                      expression: 'input.text',
                    },
                  },
                ],
                statements: [],
              },
            ],
          },
        ],
      };
      const mapAst2: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'OperationDefinition',
            name: 'Foo',
            statements: [],
          },
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'CallStatement',
                operationName: 'Foo',
                arguments: [
                  {
                    kind: 'Assignment',
                    key: ['from', 'person'],
                    value: {
                      kind: 'JessieExpression',
                      expression: 'input.person.from',
                    },
                  },
                  {
                    kind: 'Assignment',
                    key: ['to', 'person'],
                    value: {
                      kind: 'JessieExpression',
                      expression: 'input.person.wrong',
                    },
                  },
                  {
                    kind: 'Assignment',
                    key: ['message'],
                    value: {
                      kind: 'JessieExpression',
                      expression: 'input.so.wrong',
                    },
                  },
                  {
                    kind: 'Assignment',
                    key: ['super', 'wrong'],
                    value: {
                      kind: 'JessieExpression',
                      expression:
                        'input.person.something.really.wrong.do.not.do.this',
                    },
                  },
                ],
                statements: [],
              },
            ],
          },
        ],
      };

      valid(profileAst, [mapAst1]);
      invalid(
        profileAst,
        [mapAst2],
        'JessieExpression - Wrong Input Structure: expected person, to, from, text, but got input.person.wrong\n1:19 PropertyAccessExpression - Wrong Input Structure: expected person, to, from, text, but got input.person.wrong',
        ''
      );
    });
  });

  describe('usecase-map compatibility', () => {
    describe('multiple maps', () => {
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',

        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',

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
      const mapAst: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'some string',
                },
              },
            ],
          },
          {
            kind: 'MapDefinition',
            name: 'Test2',
            usecaseName: 'Test2',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: true,
                },
              },
            ],
          },
        ],
      };

      valid(profileAst, [mapAst], '', 'Extra Map');
    });
    describe('missing maps', () => {
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',

        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test1',

            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'PrimitiveTypeName',
                name: 'string',
              },
            },
          },
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test2',

            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'PrimitiveTypeName',
                name: 'boolean',
              },
            },
          },
        ],
      };
      const mapAst: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test1',
            usecaseName: 'Test1',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'some string',
                },
              },
            ],
          },
        ],
      };

      invalid(profileAst, [mapAst], 'MapDocument - Map not found: Test2', '');
    });
    describe('wrong profile name', () => {
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',

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
      const mapAst: MapASTNode = {
        kind: 'MapDocument',
        header: {
          kind: 'MapHeader',
          profile: {
            name: 'wrong',
            version: mapHeader.profile.version,
          },
          provider: mapHeader.provider,
        },
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'some string',
                },
              },
            ],
          },
        ],
      };

      invalid(
        profileAst,
        [mapAst],
        'MapHeader - Wrong Profile Name: expected whatever, but got wrong',
        ''
      );
    });
    describe('wrong scope', () => {
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
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
      const mapAst: MapASTNode = {
        kind: 'MapDocument',
        header: {
          kind: 'MapHeader',
          profile: {
            name: mapHeader.profile.name,
            scope: 'starwars',
            version: mapHeader.profile.version,
          },
          provider: mapHeader.provider,
        },
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'some string',
                },
              },
            ],
          },
        ],
      };

      invalid(
        profileAst,
        [mapAst],
        'MapHeader - Wrong Scope: expected no scope in profile, but got starwars',
        ''
      );
    });
    describe('wrong version', () => {
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',

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
      const mapAst: MapASTNode = {
        kind: 'MapDocument',
        header: {
          kind: 'MapHeader',
          profile: {
            name: mapHeader.profile.name,
            version: {
              major: 2,
              minor: 0,
              patch: 0,
            },
          },
          provider: mapHeader.provider,
        },
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'some string',
                },
              },
            ],
          },
        ],
      };

      invalid(
        profileAst,
        [mapAst],
        'MapHeader - Wrong Profile Version: expected 1.0, but got 2.0',
        ''
      );
    });
    describe('profile result missing', () => {
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',

        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            error: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'PrimitiveTypeName',
                name: 'string',
              },
            },
          },
        ],
      };
      const mapAst: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'some string',
                },
              },
            ],
          },
        ],
      };

      valid(
        profileAst,
        [mapAst],
        'OutcomeStatement - Result Not Found: returning "some string", but there is no result defined in usecase'
      );
    });
    describe('profile error missing', () => {
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',

        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
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
      const mapAst: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: true,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'some string',
                },
              },
            ],
          },
        ],
      };

      valid(
        profileAst,
        [mapAst],
        'OutcomeStatement - Error Not Found: returning "some string", but there is no error defined in usecase'
      );
    });
    describe('profile input missing', () => {
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',

        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'Test',
            error: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'PrimitiveTypeName',
                name: 'string',
              },
            },
          },
        ],
      };
      const mapAst: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'OperationDefinition',
            name: 'Foo',
            statements: [],
          },
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'OutcomeStatement',
                condition: {
                  kind: 'ConditionAtom',
                  expression: {
                    kind: 'JessieExpression',
                    expression: 'input.something',
                  },
                },
                terminateFlow: false,
                isError: true,
                value: {
                  kind: 'PrimitiveLiteral',
                  value: 'some string',
                },
              },
              {
                kind: 'OutcomeStatement',
                terminateFlow: false,
                isError: false,
                value: {
                  kind: 'InlineCall',
                  operationName: 'Foo',
                  arguments: [
                    {
                      kind: 'Assignment',
                      key: ['some', 'key'],
                      value: {
                        kind: 'JessieExpression',
                        expression: 'input.some.variable',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      invalid(
        profileAst,
        [mapAst],
        'JessieExpression - Input Not Found: input.something - there is no input defined in usecase\n1:16 PropertyAccessExpression - Input Not Found: input.something - there is no input defined in usecase\nJessieExpression - Input Not Found: input.some.variable - there is no input defined in usecase\n1:20 PropertyAccessExpression - Input Not Found: input.some.variable - there is no input defined in usecase',
        'OutcomeStatement - Result Not Found: returning "InlineCall", but there is no result defined in usecase'
      );
    });
  });
});
