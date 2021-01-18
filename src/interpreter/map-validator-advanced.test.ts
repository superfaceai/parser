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
      } else if (warning && !warn.includes(warning)) {
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
  describe('combination of input, result & error', () => {
    describe('nested', () => {
      /*
        profile = "https://example.com/profile/myProfile"

        field status string
        field deliveryStatus enum {
          accepted
          delivered
          seen
        }

        model Error {
          status,
          enum { 
            INVALID_CHARACTER, INVALID_PERSON
          }
        }
        
        usecase Test {
            input {
              person {
                  to! string!
                    from! string!
                }
                text string!
            }
            
            result {
              status
                messageID number
            }

            async result {
              messageId
              deliveryStatus
            }

            error {
              problem
              detail
              instance

              enum { 
                  INVALID_CHARACTER, INVALID_PERSON
              }
            }
        }
        */
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
            result: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'status',
                    required: true,
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
                    fieldName: 'messageID',
                    required: false,
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'number',
                    },
                  },
                ],
              },
            },
            error: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'EnumDefinition',
                values: [
                  {
                    kind: 'EnumValue',
                    value: 'INVALID_CHARACTER',
                  },
                  {
                    kind: 'EnumValue',
                    value: 'INVALID_PERSON',
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
                    ],
                  },
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
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: 'input.text',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['status'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'OK',
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
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: '!input.from',
                          },
                        },
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'PERSON_NOT_FOUND',
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
                          expression: 'input.to',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['sms', 'from'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.wrong',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['sms', 'text'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.so.wrong',
                        },
                      },
                    ],
                  },
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
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['messageID'],
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
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 404,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: true,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: '!input.from',
                          },
                        },
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'NOT_FOUND',
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
                    ],
                  },
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
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['status'],
                              value: {
                                kind: 'JessieExpression',
                                expression: 'input.text',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['messageID'],
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
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 404,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: true,

                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 'NOT_FOUND',
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
        [mapAst2, mapAst3],
        'JessieExpression - Wrong Input Structure: expected person, to, from, text, but got input.wrong\n1:12 PropertyAccessExpression - Wrong Input Structure: expected person, to, from, text, but got input.wrong\nJessieExpression - Wrong Input Structure: expected person, to, from, text, but got input.so.wrong\n1:15 PropertyAccessExpression - Wrong Input Structure: expected person, to, from, text, but got input.so.wrong\nObjectLiteral - Missing required field',
        'Wrong Structure: expected INVALID_CHARACTER or INVALID_PERSON, but got "NOT_FOUND"',
        'PrimitiveLiteral - Wrong Structure: expected INVALID_CHARACTER or INVALID_PERSON, but got "NOT_FOUND"',
        ''
      );
    });
    describe('Send Message usecase', () => {
      /**
        @profile - https://github.com/superfaceai/grid/blob/main/profiles/SendSMS/SendSMS.supr
  
        profile = "http://superface.ai/profile/conversation/SendMessage"

        usecase SendMessage unsafe {
          input {
            to string
            from string
            text string 
            channel number
          }

          result {
            messageId
          }

          async result {
            messageId
            deliveryStatus
          }

          error {
            problem string
            detail string
            instance string
          }
        }

        field messageId string

        field deliveryStatus enum {
          accepted
          delivered
          seen
        }

        field channel enum {
          sms
          whatsapp
          apple_business_chat
          facebook_messenger
        }
      */
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'SendMessage',
            safety: 'unsafe',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'to',
                    required: false,
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'string',
                    },
                  },
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'from',
                    required: false,
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'string',
                    },
                  },
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'text',
                    required: false,
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'string',
                    },
                  },
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'channel',
                    required: false,
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'number',
                    },
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
                    fieldName: 'messageId',
                    required: false,
                  },
                ],
              },
            },
            asyncResult: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'messageId',
                    required: false,
                  },
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'deliveryStatus',
                    required: false,
                  },
                ],
              },
            },
            error: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'problem',
                    required: false,
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'string',
                    },
                  },
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'detail',
                    required: false,
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'string',
                    },
                  },
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'instance',
                    required: false,
                    type: {
                      kind: 'PrimitiveTypeName',
                      name: 'string',
                    },
                  },
                ],
              },
            },
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'messageId',
            type: {
              kind: 'PrimitiveTypeName',
              name: 'string',
            },
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'deliveryStatus',
            type: {
              kind: 'EnumDefinition',
              values: [
                {
                  kind: 'EnumValue',
                  value: 'accepted',
                },
                {
                  kind: 'EnumValue',
                  value: 'delivered',
                },
                {
                  kind: 'EnumValue',
                  value: 'seen',
                },
              ],
            },
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'channel',
            type: {
              kind: 'EnumDefinition',
              values: [
                {
                  kind: 'EnumValue',
                  value: 'sms',
                },
                {
                  kind: 'EnumValue',
                  value: 'whatsapp',
                },
                {
                  kind: 'EnumValue',
                  value: 'apple_business_chat',
                },
                {
                  kind: 'EnumValue',
                  value: 'facebook_messenger',
                },
              ],
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
            name: 'SendMessage',
            usecaseName: 'SendMessage',
            statements: [
              {
                kind: 'HttpCallStatement',
                method: 'POST',
                url: 'http://www.example.com/{input.channel}',
                request: {
                  kind: 'HttpRequest',
                  body: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['sms', 'to'],
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
                    ],
                  },
                },
                responseHandlers: [
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: true,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: '!input.person',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['problem'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'Person not found.',
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
                              key: ['deliveryStatus'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'accepted',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['messageID'],
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
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: true,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: '!input.person',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['problem'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'Person not found.',
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: false,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: 'input.text',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['deliveryStatus'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'seen',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['messageID'],
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
            name: 'SendMessage',
            usecaseName: 'SendMessage',
            statements: [
              {
                kind: 'HttpCallStatement',
                method: 'POST',
                url: 'http://www.example.com/{input.channel}',
                request: {
                  kind: 'HttpRequest',
                  body: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['sms', 'to'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.is.wrong',
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
                          expression: 'input.person',
                        },
                      },
                    ],
                  },
                },
                responseHandlers: [
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: true,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: '!input.some.person',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['some', 'key'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'some error outcome',
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
                              key: ['deliveryStatus'],
                              value: {
                                kind: 'ObjectLiteral',
                                fields: [],
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['messageID'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: false,
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: true,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: '!input.person',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['status'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'ERROR.',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['statusID'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: '1',
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: false,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: 'input.text',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['status'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'OK.',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['messageID'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: false,
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
      const mapAst3: MapASTNode = {
        kind: 'MapDocument',
        header: mapHeader,
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'SendMessage',
            usecaseName: 'SendMessage',
            statements: [
              {
                kind: 'HttpCallStatement',
                method: 'POST',
                url: 'http://www.example.com/{input.channel}',
                request: {
                  kind: 'HttpRequest',
                  body: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['sms', 'to'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.is.wrong',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['sms', 'from'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.very.very.wrong',
                        },
                      },
                    ],
                  },
                },
                responseHandlers: [
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
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
                              key: ['some', 'key'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'some error outcome',
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: false,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: '!input.some.person',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['deliveryStatus'],
                              value: {
                                kind: 'ObjectLiteral',
                                fields: [],
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['messageID'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: false,
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
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
                              key: ['status'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'ERROR.',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['statusID'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: '1',
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
                              key: ['status'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'OK.',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['messageID'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: false,
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

      valid(profileAst, [mapAst1]);
      invalid(
        profileAst,
        [mapAst2, mapAst3],
        'JessieExpression - Wrong Input Structure: expected to, from, text, channel, but got input.is.wrong\n1:15 PropertyAccessExpression - Wrong Input Structure: expected to, from, text, channel, but got input.is.wrong\nJessieExpression - Wrong Input Structure: expected to, from, text, channel, but got input.person\n1:13 PropertyAccessExpression - Wrong Input Structure: expected to, from, text, channel, but got input.person',
        'ObjectLiteral - Wrong Object Structure: expected problem, detail, instance, but got some.key\nObjectLiteral - Wrong Object Structure: expected messageId, but got deliveryStatus, messageID\nObjectLiteral - Wrong Object Structure: expected problem, detail, instance, but got status, statusID\nObjectLiteral - Wrong Object Structure: expected messageId, but got status, messageID',
        'JessieExpression - Wrong Input Structure: expected to, from, text, channel, but got input.is.wrong\n1:15 PropertyAccessExpression - Wrong Input Structure: expected to, from, text, channel, but got input.is.wrong\nJessieExpression - Wrong Input Structure: expected to, from, text, channel, but got input.very.very.wrong\n1:22 PropertyAccessExpression - Wrong Input Structure: expected to, from, text, channel, but got input.very.very.wrong',
        'ObjectLiteral - Wrong Object Structure: expected problem, detail, instance, but got some.key\nObjectLiteral - Wrong Object Structure: expected messageId, but got deliveryStatus, messageID\nObjectLiteral - Wrong Object Structure: expected problem, detail, instance, but got status, statusID\nObjectLiteral - Wrong Object Structure: expected messageId, but got status, messageID'
      );
    });
    describe('Send Message usecase with any structures', () => {
      /**
        @profile - https://github.com/superfaceai/grid/blob/main/profiles/SendSMS/SendSMS.supr
  
        profile = "http://superface.ai/profile/conversation/SendMessage"

        usecase SendMessage unsafe {
          input {
            to 
            from 
            text  
            channel 
          }

          result {
            messageId
          }

          async result {
            messageId
            deliveryStatus
          }

          error {
            problem 
            detail 
            instance 
          }
        }

        field messageId string

        field deliveryStatus enum {
          accepted
          delivered
          seen
        }

        field channel enum {
          sms
          whatsapp
          apple_business_chat
          facebook_messenger
        }
      */
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'SendMessage',
            safety: 'unsafe',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'to',
                    required: false,
                  },
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'from',
                    required: false,
                  },
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'text',
                    required: false,
                  },
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'channel',
                    required: false,
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
                    fieldName: 'messageId',
                    required: false,
                  },
                ],
              },
            },
            asyncResult: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'messageId',
                    required: false,
                  },
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'deliveryStatus',
                    required: false,
                  },
                ],
              },
            },
            error: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'problem',
                    required: false,
                  },
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'detail',
                    required: false,
                  },
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'instance',
                    required: false,
                  },
                ],
              },
            },
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'messageId',
            type: {
              kind: 'PrimitiveTypeName',
              name: 'string',
            },
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'deliveryStatus',
            type: {
              kind: 'EnumDefinition',
              values: [
                {
                  kind: 'EnumValue',
                  value: 'accepted',
                },
                {
                  kind: 'EnumValue',
                  value: 'delivered',
                },
                {
                  kind: 'EnumValue',
                  value: 'seen',
                },
              ],
            },
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'channel',
            type: {
              kind: 'EnumDefinition',
              values: [
                {
                  kind: 'EnumValue',
                  value: 'sms',
                },
                {
                  kind: 'EnumValue',
                  value: 'whatsapp',
                },
                {
                  kind: 'EnumValue',
                  value: 'apple_business_chat',
                },
                {
                  kind: 'EnumValue',
                  value: 'facebook_messenger',
                },
              ],
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
            name: 'SendMessage',
            usecaseName: 'SendMessage',
            statements: [
              {
                kind: 'HttpCallStatement',
                method: 'POST',
                url: 'http://www.example.com/{input.channel}',
                request: {
                  kind: 'HttpRequest',
                  body: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['sms', 'to'],
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
                    ],
                  },
                },
                responseHandlers: [
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: true,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: '!input.person',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['problem'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'Person not found.',
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
                              key: ['deliveryStatus'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'accepted',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['messageID'],
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
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: true,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: '!input.person',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['problem'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'Person not found.',
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: false,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: 'input.text',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['deliveryStatus'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'seen',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['messageID'],
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
            name: 'SendMessage',
            usecaseName: 'SendMessage',
            statements: [
              {
                kind: 'HttpCallStatement',
                method: 'POST',
                url: 'http://www.example.com/{input.channel}',
                request: {
                  kind: 'HttpRequest',
                  body: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['sms', 'to'],
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
                    ],
                  },
                },
                responseHandlers: [
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: true,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: '!input.channel',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['problem'],
                              value: {
                                kind: 'ObjectLiteral',
                                fields: [
                                  {
                                    kind: 'Assignment',
                                    key: ['problemID'],
                                    value: {
                                      kind: 'PrimitiveLiteral',
                                      value: 1,
                                    },
                                  },
                                  {
                                    kind: 'Assignment',
                                    key: ['description'],
                                    value: {
                                      kind: 'PrimitiveLiteral',
                                      value: 'some error outcome',
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
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: true,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: '!input.text',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['problem'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'ERROR.',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['detail'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: '1',
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: false,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: 'input.text',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['deliveryStatus'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'accepted',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['messageID'],
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
                ],
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
            name: 'SendMessage',
            usecaseName: 'SendMessage',
            statements: [
              {
                kind: 'HttpCallStatement',
                method: 'POST',
                url: 'http://www.example.com/{input.channel}',
                request: {
                  kind: 'HttpRequest',
                  body: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['sms', 'to'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.is.wrong',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['sms', 'from'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.very.very.wrong',
                        },
                      },
                    ],
                  },
                },
                responseHandlers: [
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
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
                              key: ['some', 'key'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'some error outcome',
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'OutcomeStatement',
                        terminateFlow: false,
                        isError: false,
                        condition: {
                          kind: 'StatementCondition',
                          expression: {
                            kind: 'JessieExpression',
                            expression: '!input.some.person',
                          },
                        },
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['messageID'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: false,
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
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
                              key: ['status'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'ERROR.',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['statusID'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: '1',
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
                              key: ['status'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'OK.',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['messageID'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: false,
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
                              key: ['status'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'ERROR.',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['statusID'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: '1',
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
                              key: ['status'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'OK.',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['messageID'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: false,
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

      valid(profileAst, [mapAst1, mapAst2]);
      invalid(
        profileAst,
        [mapAst3],
        'JessieExpression - Wrong Input Structure: expected to, from, text, channel, but got input.is.wrong\n1:15 PropertyAccessExpression - Wrong Input Structure: expected to, from, text, channel, but got input.is.wrong\nJessieExpression - Wrong Input Structure: expected to, from, text, channel, but got input.very.very.wrong\n1:22 PropertyAccessExpression - Wrong Input Structure: expected to, from, text, channel, but got input.very.very.wrong',
        'ObjectLiteral - Wrong Object Structure: expected problem, detail, instance, but got some.key\nObjectLiteral - Wrong Object Structure: expected messageId, but got messageID\nObjectLiteral - Wrong Object Structure: expected problem, detail, instance, but got status, statusID\nObjectLiteral - Wrong Object Structure: expected messageId, but got status, messageID\nObjectLiteral - Wrong Object Structure: expected problem, detail, instance, but got status, statusID\nObjectLiteral - Wrong Object Structure: expected messageId, but got status, messageID'
      );
    });
    describe('Retrieve Message Status usecase', () => {
      /**
        @profile - https://github.com/superfaceai/grid/blob/main/profiles/SendSMS/SendSMS.supr
  
        profile = "http://superface.ai/profile/conversation/SendMessage"
  
        usecase RetrieveMessageStatus safe {
          input {
            messageId
          }
  
          result {
            deliveryStatus
          }
  
          async result A
        }
  
        field messageId string
  
        field deliveryStatus enum {
          accepted
          delivered
          seen
        }
  
        field channel enum {
          sms
          whatsapp
          apple_business_chat
          facebook_messenger
        }
       */
      const profileAst: ProfileDocumentNode = {
        kind: 'ProfileDocument',
        header: profileHeader,
        definitions: [
          {
            kind: 'UseCaseDefinition',
            useCaseName: 'RetrieveMessageStatus',
            safety: 'safe',
            input: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [
                  {
                    kind: 'FieldDefinition',
                    fieldName: 'messageId',
                    required: false,
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
                    fieldName: 'deliveryStatus',
                    required: false,
                  },
                ],
              },
            },
            asyncResult: {
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ModelTypeName',
                name: 'A',
              },
            },
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'messageId',
            type: {
              kind: 'PrimitiveTypeName',
              name: 'string',
            },
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'deliveryStatus',
            type: {
              kind: 'EnumDefinition',
              values: [
                {
                  kind: 'EnumValue',
                  value: 'accepted',
                },
                {
                  kind: 'EnumValue',
                  value: 'delivered',
                },
                {
                  kind: 'EnumValue',
                  value: 'seen',
                },
              ],
            },
          },
          {
            kind: 'NamedFieldDefinition',
            fieldName: 'channel',
            type: {
              kind: 'EnumDefinition',
              values: [
                {
                  kind: 'EnumValue',
                  value: 'sms',
                },
                {
                  kind: 'EnumValue',
                  value: 'whatsapp',
                },
                {
                  kind: 'EnumValue',
                  value: 'apple_business_chat',
                },
                {
                  kind: 'EnumValue',
                  value: 'facebook_messenger',
                },
              ],
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
            name: 'RetrieveMessageStatus',
            usecaseName: 'RetrieveMessageStatus',
            statements: [
              {
                kind: 'HttpCallStatement',
                method: 'POST',
                url: 'http://www.example.com/',
                request: {
                  kind: 'HttpRequest',
                  contentType: 'application/json',
                  body: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['sms', 'messageId'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.messageId',
                          source: 'input.messageId',
                          sourceMap: 'AAAA,IAAI,CAAC,GAAG,KAAK,CAAC,SAAS,CAAC',
                        },
                      },
                    ],
                  },
                },
                responseHandlers: [
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        isError: false,
                        terminateFlow: false,
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['deliveryStatus'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'seen',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 300,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        isError: false,
                        terminateFlow: false,
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['deliveryStatus'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'accepted',
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
            name: 'RetrieveMessageStatus',
            usecaseName: 'RetrieveMessageStatus',
            statements: [
              {
                kind: 'HttpCallStatement',
                method: 'POST',
                url: 'http://www.example.com/',
                request: {
                  kind: 'HttpRequest',
                  contentType: 'application/json',
                  body: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['sms', 'messageId'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.wrong.key["in"].input',
                          source: 'input.wrong.key.in.input',
                          sourceMap:
                            'AAAA,IAAI,CAAC,GAAG,KAAK,CAAC,KAAK,CAAC,GAAG,CAAC,IAAE,CAAA,CAAC,KAAK,CAAC',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['some', 'body'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'body.sid',
                        },
                      },
                      {
                        kind: 'Assignment',
                        key: ['sms', 'to'],
                        value: {
                          kind: 'JessieExpression',
                          expression: 'input.to',
                          source: 'input.to',
                          sourceMap: 'AAAA,IAAI,CAAC,GAAG,KAAK,CAAC,EAAE,CAAC',
                        },
                      },
                    ],
                  },
                },
                responseHandlers: [
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 200,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        isError: true,
                        terminateFlow: false,
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['some', 'key'],
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
                        isError: false,
                        terminateFlow: false,
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['status'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'OK',
                              },
                            },
                            {
                              kind: 'Assignment',
                              key: ['some', 'key'],
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
                  {
                    kind: 'HttpResponseHandler',
                    statusCode: 300,
                    statements: [
                      {
                        kind: 'OutcomeStatement',
                        isError: false,
                        terminateFlow: false,
                        value: {
                          kind: 'ObjectLiteral',
                          fields: [
                            {
                              kind: 'Assignment',
                              key: ['status'],
                              value: {
                                kind: 'PrimitiveLiteral',
                                value: 'OK',
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

      valid(profileAst, [mapAst1]);
      invalid(
        profileAst,
        [mapAst2],
        'JessieExpression - Wrong Input Structure: expected messageId, but got input.wrong.key.in.input\n1:25 PropertyAccessExpression - Wrong Input Structure: expected messageId, but got input.wrong.key.in.input\nJessieExpression - Wrong Input Structure: expected messageId, but got input.to\n1:9 PropertyAccessExpression - Wrong Input Structure: expected messageId, but got input.to',
        'OutcomeStatement - Error Not Found: returning "ObjectLiteral", but there is no error defined in usecase\nObjectLiteral - Wrong Object Structure: expected deliveryStatus, but got status, some.key\nObjectLiteral - Wrong Object Structure: expected deliveryStatus, but got status'
      );
    });
  });
});
