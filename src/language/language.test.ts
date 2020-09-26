import { Source } from './source';
import { parseProfile, parseRule } from './syntax/parser';
import { SyntaxRule } from './syntax/rule';
import * as mapRules from './syntax/rules/map';
import { STATEMENT_CONDITION } from './syntax/rules/map/map';
import { ARGUMENT_LIST_ASSIGNMENT } from './syntax/rules/map/value';
import * as profileRules from './syntax/rules/profile';

describe('v6', () => {
  it('should parse constructs.profile', () => {
    const input = `
    model X [
      enum {
      A
      B
      }
    ]
    
    model A {} 
    
    model Y { name } | { email }
    
    field fieldName B! | A!`;

    const source = new Source(input);
    const definitions = parseRule(
      SyntaxRule.repeat(profileRules.DOCUMENT_DEFINITION),
      source,
      true
    );

    expect(definitions).toMatchObject([
      {
        kind: 'NamedModelDefinition',
        modelName: 'X',
        type: {
          kind: 'ListDefinition',
          elementType: {
            kind: 'EnumDefinition',
          },
        },
      },
      {
        kind: 'NamedModelDefinition',
        modelName: 'A',
        type: {
          kind: 'ObjectDefinition',
        },
      },
      {
        kind: 'NamedModelDefinition',
        modelName: 'Y',
        type: {
          kind: 'UnionDefinition',
          types: [{ kind: 'ObjectDefinition' }, { kind: 'ObjectDefinition' }],
        },
      },
      {
        kind: 'NamedFieldDefinition',
        fieldName: 'fieldName',
        type: {
          kind: 'UnionDefinition',
          types: [
            { kind: 'NonNullDefinition', type: { kind: 'ModelTypeName' } },
            { kind: 'NonNullDefinition', type: { kind: 'ModelTypeName' } },
          ],
        },
      },
    ]);
  });

  it('should parse conversation.profile', () => {
    const input = `profile = "http://superface.ai/profile/conversation/SendMessage"

    "Send single conversation message"
    usecase SendMessage unsafe {
      input {
        to
        from
        channel
        text
      }
    
      """
      Title
      Description of the result
      """
      result {
        messageId!
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
    
    "Retrieve status of a sent message"
    usecase RetrieveMessageStatus safe {
      input {
        messageId
      }
    
      result {
        deliveryStatus
      }
    }
    
    "Identifier of Message
      The identifier is channel-specific and not unique. It should be treated as an opaque value and only used in subsequent calls"
    field messageId string
    
    "Delivery Status of Message
      Status of a sent message. Harmonized across different channels."
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
    `;

    const source = new Source(input);
    const profile = parseProfile(source);

    expect(profile).toMatchObject({
      kind: 'ProfileDocument',
      profile: {
        kind: 'Profile',
        profileId: {
          kind: 'ProfileId',
          profileId: 'http://superface.ai/profile/conversation/SendMessage',
        },
      },
      definitions: [
        {
          kind: 'UseCaseDefinition',
          title: 'Send single conversation message',
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
                },
                {
                  kind: 'FieldDefinition',
                  fieldName: 'from',
                },
                {
                  kind: 'FieldDefinition',
                  fieldName: 'channel',
                },
                {
                  kind: 'FieldDefinition',
                  fieldName: 'text',
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
                  required: true,
                },
              ],
            },
            title: 'Title',
            description: 'Description of the result',
          },
          asyncResult: {
            kind: 'UseCaseSlotDefinition',
            type: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'messageId',
                },
                {
                  kind: 'FieldDefinition',
                  fieldName: 'deliveryStatus',
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
                },
                {
                  kind: 'FieldDefinition',
                  fieldName: 'detail',
                },
                {
                  kind: 'FieldDefinition',
                  fieldName: 'instance',
                },
              ],
            },
          },
        },
        {
          kind: 'UseCaseDefinition',
          useCaseName: 'RetrieveMessageStatus',
          safety: 'safe',
          asyncResult: undefined,
          error: undefined,
        },
        {
          kind: 'NamedFieldDefinition',
          fieldName: 'messageId',
          type: {
            kind: 'PrimitiveTypeName',
            name: 'string',
          },
          title: 'Identifier of Message',
          description:
            'The identifier is channel-specific and not unique. It should be treated as an opaque value and only used in subsequent calls',
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
          title: 'Delivery Status of Message',
          description:
            'Status of a sent message. Harmonized across different channels.',
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
    });
  });

  it('should parse UWE model', () => {
    const input = `model UWE {
      f1 enum { a, b }
      f2 string 
      f3 {
        f3a
        f3b
      }
      f4 { f4a, f4b boolean }     # Ok with comma; however without comma -> error
      # f5 f6 f7                    # -> error
      f8, f9, f10                 # -> OK
      # f11 string f12              # -> error
      f13 string, f14             # -> OK
    }`;

    const source = new Source(input);
    const model = parseRule(profileRules.NAMED_MODEL_DEFINITION, source, true);

    expect(model).toMatchObject({
      kind: 'NamedModelDefinition',
      modelName: 'UWE',
      type: {
        kind: 'ObjectDefinition',
        fields: [
          // f1 enum { a, b }
          {
            kind: 'FieldDefinition',
            fieldName: 'f1',
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
          // f2 string
          {
            kind: 'FieldDefinition',
            fieldName: 'f2',
            type: {
              kind: 'PrimitiveTypeName',
              name: 'string',
            },
          },
          // f3 { f3a\nf3b\n }
          {
            kind: 'FieldDefinition',
            fieldName: 'f3',
            type: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'f3a',
                },
                {
                  kind: 'FieldDefinition',
                  fieldName: 'f3b',
                },
              ],
            },
          },
          // f4 { f4a, f4b boolean }
          {
            kind: 'FieldDefinition',
            fieldName: 'f4',
            type: {
              kind: 'ObjectDefinition',
              fields: [
                {
                  kind: 'FieldDefinition',
                  fieldName: 'f4a',
                },
                {
                  kind: 'FieldDefinition',
                  fieldName: 'f4b',
                  type: {
                    kind: 'PrimitiveTypeName',
                    name: 'boolean',
                  },
                },
              ],
            },
          },

          // f8, f9, f10
          {
            kind: 'FieldDefinition',
            fieldName: 'f8',
          },
          {
            kind: 'FieldDefinition',
            fieldName: 'f9',
          },
          {
            kind: 'FieldDefinition',
            fieldName: 'f10',
          },

          // f13 string, f14
          {
            kind: 'FieldDefinition',
            fieldName: 'f13',
            type: {
              kind: 'PrimitiveTypeName',
              name: 'string',
            },
          },
          {
            kind: 'FieldDefinition',
            fieldName: 'f14',
          },
        ],
      },
    });
  });
});

describe('v8', () => {
  describe('jessie contexts', () => {
    it('should parse jessie condition expression', () => {
      const input = 'if ((() => { const a = 1; return { foo: a + 2 }; })())';

      const source = new Source(input);
      const condition = parseRule(STATEMENT_CONDITION, source, true);

      expect(condition).toMatchObject({
        kind: 'StatementCondition',
        expression: {
          kind: 'JessieExpression',
          expression: '(function () { var a = 1; return { foo: a + 2 }; })()',
          source: '(() => { const a = 1; return { foo: a + 2 }; })()',
        },
      });
    });

    it('should parse jessie rhs in object literal', () => {
      const input = `{
        foo = input.call()
        bar = 1 + 2 + 3
        baz.qux = [1, 2, 3].map(x => x * x)
      }`;

      const source = new Source(input);
      const object = parseRule(mapRules.OBJECT_LITERAL, source, true);

      expect(object).toMatchObject({
        kind: 'ObjectLiteral',
        fields: [
          {
            kind: 'Assignment',
            key: ['foo'],
            value: {
              kind: 'JessieExpression',
              expression: 'input.call()',
            },
          },
          {
            kind: 'Assignment',
            key: ['bar'],
            value: {
              kind: 'JessieExpression',
              expression: '1 + 2 + 3',
            },
          },
          {
            kind: 'Assignment',
            key: ['baz', 'qux'],
            value: {
              kind: 'JessieExpression',
              expression: '[1, 2, 3].map(function (x) { return x * x; })',
            },
          },
        ],
      });
    });

    it('should parse jessie expression in array literal', () => {
      const input = '[1 + 2, 3 * 4, 5, [true], [7] + [8]]';

      const source = new Source(input);

      const object = parseRule(mapRules.ARRAY_LITERAL, source, true);

      expect(object).toMatchObject({
        kind: 'ArrayLiteral',
        elements: [
          {
            kind: 'JessieExpression',
            expression: '1 + 2',
          },
          {
            kind: 'JessieExpression',
            expression: '3 * 4',
          },
          {
            kind: 'PrimitiveLiteral',
            value: 5,
          },
          {
            kind: 'ArrayLiteral',
            elements: [
              {
                kind: 'PrimitiveLiteral',
                value: true,
              },
            ],
          },
          {
            kind: 'JessieExpression',
            expression: '[7] + [8]',
          },
        ],
      });
    });

    it('should parse jessie rhs in operation call arguments', () => {
      const input = 'foo = "hi", bar = 1 + 2, baz = `format ${formatMe + `${nested}`} and ${formatThat} please`, quz = true)'

      const source = new Source(input);

      const args = parseRule(
        SyntaxRule.repeat(ARGUMENT_LIST_ASSIGNMENT),
        source,
        true
      );

      expect(args).toMatchObject([
        {
          kind: 'Assignment',
          key: ['foo'],
          value: {
            kind: 'PrimitiveLiteral',
            value: 'hi'
          }
        },
        {
          kind: 'Assignment',
          key: ['bar'],
          value: {
            kind: 'JessieExpression',
            expression: '1 + 2'
          }
        },
        {
          kind: 'Assignment',
          key: ['baz'],
          value: {
            kind: 'JessieExpression',
            expression: '"format " + (formatMe + ("" + nested)) + " and " + formatThat + " please"'
          }
        },
        {
          kind: 'Assignment',
          key: ['quz'],
          value: {
            kind: 'PrimitiveLiteral',
            value: true
          }
        }
      ])
    });
  });

  it('should parse conversation.tyntec.map', () => {
    const input = `profile = "http://superface.ai/profile/conversation/SendMessage"
    provider = "http://superface.ai/directory/Tyntec#SMS"
    
    # Tyntec API documentation available at:
    #   https://api.tyntec.com/reference/#conversations-send-messages-send-a-message
    
    map SendMessage {
      http POST "https://api.tyntec.com/chat-api/v2/messages" {
        request {
          body {
            to = input.to
            channels = ['sms']
            sms.from = input.from
            sms.contentType = 'text'
            sms.text = input.text
          }
        }
    
        response 200 "application/json" {
          map result {
            messageId = body.messageId
          }
        }
      }
    }
    
    map RetrieveMessageStatus {
      messageId = input.messageId
    
      http GET "https://api.tyntec.com/chat-api/v2/messages/{messageId}/history" {
        response 200 "application/json" {
          map result {
            deliveryStatus = body.history[0].state
          }
        }
      } 
    }
    `;

    const source = new Source(input);
    const map = parseRule(mapRules.MAP_DOCUMENT, source);

    expect(map).toMatchObject({
      kind: 'MapDocument',
      map: {
        kind: 'Map',
        profileId: {
          kind: 'ProfileId',
          profileId: 'http://superface.ai/profile/conversation/SendMessage',
        },
        provider: {
          kind: 'Provider',
          providerId: 'http://superface.ai/directory/Tyntec#SMS',
        },
      },
      definitions: [
        {
          kind: 'MapDefinition',
          name: 'SendMessage',
          usecaseName: 'SendMessage',
          statements: [
            {
              kind: 'HttpCallStatement',
              method: 'POST',
              url: 'https://api.tyntec.com/chat-api/v2/messages',
              requestDefinition: {
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
                      key: ['channels'],
                      value: {
                        kind: 'ArrayLiteral',
                        elements: [
                          {
                            kind: 'PrimitiveLiteral',
                            value: 'sms',
                          },
                        ],
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
                      key: ['sms', 'contentType'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'text',
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
                  contentType: 'application/json',
                  statements: [
                    {
                      kind: 'MapResultStatement',
                      value: {
                        kind: 'ObjectLiteral',
                        fields: [
                          {
                            kind: 'Assignment',
                            key: ['messageId'],
                            value: {
                              kind: 'JessieExpression',
                              expression: 'body.messageId',
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
        {
          kind: 'MapDefinition',
          name: 'RetrieveMessageStatus',
          usecaseName: 'RetrieveMessageStatus',
          statements: [
            {
              kind: 'SetStatement',
              assignments: [
                {
                  kind: 'Assignment',
                  key: ['messageId'],
                  value: {
                    kind: 'JessieExpression',
                    expression: 'input.messageId',
                  },
                },
              ],
            },
            {
              kind: 'HttpCallStatement',
              method: 'GET',
              url:
                'https://api.tyntec.com/chat-api/v2/messages/{messageId}/history',
              requestDefinition: {},
              responseHandlers: [
                {
                  kind: 'HttpResponseHandler',
                  statusCode: 200,
                  contentType: 'application/json',
                  statements: [
                    {
                      kind: 'MapResultStatement',
                      value: {
                        kind: 'ObjectLiteral',
                        fields: [
                          {
                            kind: 'Assignment',
                            key: ['deliveryStatus'],
                            value: {
                              kind: 'JessieExpression',
                              expression: 'body.history[0].state',
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
    });
  });

  it('should parse computation.map', () => {
    const input = `operation foo {
      return {
        answer = 42
        hash = { a = 1, b = 2 }
      }
    }
    
    operation fooWithArgs {
      return if (args.success) {
        answer = 42
      }
    
      fail if (!args.success) {
        message = "I am supposed to fail"
      }
    }
    
    operation bar {
      call fooWithArgs(success = \x60Muj string \x24{someVar}\x60, neco.foo = 4+2 ) {
        return if (!error) {
          finalAnswer = "The final answer is " + data.answer
        }
    
        fail if (error) {
          finalAnswer = "There was an error " + error.message
        }
      }
    
    }
    
    operation countArray {
      count = args.array.reduce((acc, curr) => acc + 1, 0)
    
      return {
        answer = "This is the count " + count
      }
    }
    `

    const source = new Source(input);

    const definitions = parseRule(
      SyntaxRule.repeat(mapRules.DOCUMENT_DEFINITION),
      source,
      true
    );

    expect(definitions[0]).toMatchObject(
      {
        kind: 'OperationDefinition',
        name: 'foo',
        statements: [
          {
            kind: 'ReturnStatement',
            value: {
              kind: 'ObjectLiteral',
              fields: [
                {
                  kind: 'Assignment',
                  key: ['answer'],
                  value: {
                    kind: 'PrimitiveLiteral',
                    value: 42
                  }
                },
                {
                  kind: 'Assignment',
                  key: ['hash'],
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['a'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 1
                        }
                      },
                      {
                        kind: 'Assignment',
                        key: ['b'],
                        value: {
                          kind: 'PrimitiveLiteral',
                          value: 2
                        }
                      },
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    )

    expect(definitions[1]).toMatchObject(
      {
        kind: 'OperationDefinition',
        name: 'fooWithArgs',
        statements: [
          {
            kind: 'ReturnStatement',
            condition: {
              kind: 'StatementCondition',
              expression: {
                kind: 'JessieExpression',
                expression: 'args.success'
              }
            },
            value: {
              kind: 'ObjectLiteral',
              fields: [
                {
                  kind: 'Assignment',
                  key: ['answer'],
                  value: {
                    kind: 'PrimitiveLiteral',
                    value: 42
                  }
                }
              ]
            }
          },
          {
            kind: 'FailStatement',
            condition: {
              kind: 'StatementCondition',
              expression: {
                kind: 'JessieExpression',
                expression: '!args.success'
              }
            },
            value: {
              kind: 'ObjectLiteral',
              fields: [
                {
                  kind: 'Assignment',
                  key: ['message'],
                  value: {
                    kind: 'PrimitiveLiteral',
                    value: "I am supposed to fail"
                  }
                }
              ]
            }
          }
        ]
      }
    )

    expect(definitions[2]).toMatchObject(
      {
        kind: 'OperationDefinition',
        name: 'bar',
        statements: [
          {
            kind: 'CallStatement',
            operationName: 'fooWithArgs',
            arguments: [
              {
                kind: 'Assignment',
                key: ['success'],
                value: {
                  kind: 'JessieExpression',
                  expression: '"Muj string " + someVar'
                }
              },
              {
                kind: 'Assignment',
                key: ['neco', 'foo'],
                value: {
                  kind: 'JessieExpression',
                  expression: '4 + 2'
                }
              }
            ],
            statements: [
              {
                kind: 'ReturnStatement',
                condition: {
                  kind: 'StatementCondition',
                  expression: {
                    kind: 'JessieExpression',
                    expression: '!error'
                  }
                },
                value: {
                  kind: 'ObjectLiteral',
                  fields: [
                    {
                      kind: 'Assignment',
                      key: ['finalAnswer'],
                      value: {
                        kind: 'JessieExpression',
                        expression: '"The final answer is " + data.answer'
                      }
                    }
                  ]
                }
              },
              {
                kind: 'FailStatement',
                condition: {
                  kind: 'StatementCondition',
                  expression: {
                    kind: 'JessieExpression',
                    expression: 'error'
                  }
                },
                value: {
                  kind: 'ObjectLiteral',
                  fields: [
                    {
                      kind: 'Assignment',
                      key: ['finalAnswer'],
                      value: {
                        kind: 'JessieExpression',
                        expression: '"There was an error " + error.message'
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    )

    expect(definitions[3]).toMatchObject(
      {
        kind: 'OperationDefinition',
        name: 'countArray',
        statements: [
          {
            kind: 'SetStatement',
            assignments: [
              {
                kind: 'Assignment',
                key: ['count'],
                value: {
                  kind: 'JessieExpression',
                  expression: 'args.array.reduce(function (acc, curr) { return acc + 1; }, 0)'
                }
              }
            ]
          },
          {
            kind: 'ReturnStatement',
            value: {
              kind: 'ObjectLiteral',
              fields: [
                {
                  kind: 'Assignment',
                  key: ['answer'],
                  value: {
                    kind: 'JessieExpression',
                    expression: '"This is the count " + count'
                  }
                }
              ]
            }
          }
        ]
      }
    )
  });
});
