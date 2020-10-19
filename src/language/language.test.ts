import { Source } from './source';
import {
  parseMap,
  parseMapExtended,
  parseProfile,
  parseRule,
} from './syntax/parser';
import { SyntaxRule } from './syntax/rule';
import { mapCommon, mapStrict } from './syntax/rules/map';
import { profile as profileRules } from './syntax/rules/profile';

describe('profile', () => {
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
      SyntaxRule.repeat(profileRules.PROFILE_DOCUMENT_DEFINITION),
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

const STRICT_MAP = `
# https://sfspec.surge.sh/map#sec-Map-Document
"""
Strict Map

Example of the map syntax adhering to the strict syntax.
"""

profile = "http://example.com/profile"
provider = "http://example.com/provider"

# https://sfspec.surge.sh/map#sec-Usecase-Map
"Map Foo
Description of the map Foo"
map Foo {
	# https://sfspec.surge.sh/map#sec-Set-Variables

	set if (!cond) {
		foo = 1
		"foo" = 1 + 1
		"foo.bar".bar = call Op()
  	}
	
	set {
		foo = 1
	}

	foo = 1
	"foo.bar".bar = call Op()

	# https://sfspec.surge.sh/map#sec-Operation-Call

	call Op(foo = 1, bar = 1 + 1) if (cond) {
		# https://sfspec.surge.sh/map#SetOutcome
		# https://sfspec.surge.sh/map#SetMapOutcome

		# https://sfspec.surge.sh/map#MapResult
		map result if (cond) {
			foo = 1
		}
		return map result if (cond) {
			"foo" = 1
		}

		# https://sfspec.surge.sh/map#sec-Map-Error
		map error if (cond) {
			"foo.bar" = 1
		}
		return map error if (cond) {
			foo.bar = 1
		}
	}

	# https://sfspec.surge.sh/map#HTTPCall
	http GET "/api/{foo}/bar" {
		# https://sfspec.surge.sh/map#HTTPRequest
		request "application/json" {
			# https://sfspec.surge.sh/map#URLQuery
			query {
				foo = "hello",
				bar = "world"
			}

			# https://sfspec.surge.sh/map#HTTPHeaders
			headers {
				"User-Agent" = "superface v1"
			}

			# https://sfspec.surge.sh/map#HTTPBody
			body {
				foo = 1,
				bar = 1 + 1,
				"foo.bar".bar = "3"
			}
		}

		# https://sfspec.surge.sh/map#HTTPRespose
		response 300 {
			map result {
				foo = 1
			}
		}

		# https://sfspec.surge.sh/map#HTTPRespose
		response "application/json" {
			map error {
				foo = 1
			}
		}

		# https://sfspec.surge.sh/map#HTTPRespose
		response "*" "en-US" {
			return map result {
				foo = 1
			}
		}

		# https://sfspec.surge.sh/map#HTTPRespose
		response {
			return map error {
				foo = 1
			}
		}
	}

	http POST "/" {
		# https://sfspec.surge.sh/map#HTTPRequest
		request {
			# https://sfspec.surge.sh/map#HTTPBody
			body = [1, 2, 3]
		}

		response 404 "text/html" "en-US" {
			foo = 1
		}
	}
}
`;

const STRICT_MAP_AST = {
  kind: 'MapDocument',
  map: {
    kind: 'Map',
    profileId: {
      kind: 'ProfileId',
      profileId: 'http://example.com/profile',
    },
    provider: {
      kind: 'Provider',
      providerId: 'http://example.com/provider',
    },
  },
  definitions: [
    {
      kind: 'MapDefinition',
      name: 'Foo',
      usecaseName: 'Foo',
      statements: [
        {
          kind: 'SetStatement',
          condition: {
            kind: 'StatementCondition',
            expression: {
              kind: 'JessieExpression',
              expression: '!cond',
            },
          },
          assignments: [
            {
              kind: 'Assignment',
              key: ['foo'],
              value: {
                kind: 'PrimitiveLiteral',
                value: 1,
              },
            },
            {
              kind: 'Assignment',
              key: ['foo'],
              value: {
                kind: 'JessieExpression',
                expression: '1 + 1',
              },
            },
            {
              kind: 'Assignment',
              key: ['foo.bar', 'bar'],
              value: {
                kind: 'InlineCall',
                operationName: 'Op',
                arguments: [],
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
                value: 1,
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
                value: 1,
              },
            },
          ],
        },
        {
          kind: 'SetStatement',
          assignments: [
            {
              kind: 'Assignment',
              key: ['foo.bar', 'bar'],
              value: {
                kind: 'InlineCall',
                operationName: 'Op',
                arguments: [],
              },
            },
          ],
        },
        {
          kind: 'CallStatement',
          operationName: 'Op',
          arguments: [
            {
              kind: 'Assignment',
              key: ['foo'],
              value: {
                kind: 'PrimitiveLiteral',
                value: 1,
              },
            },
            {
              kind: 'Assignment',
              key: ['bar'],
              value: {
                kind: 'JessieExpression',
                expression: '1 + 1',
              },
            },
          ],
          condition: {
            kind: 'StatementCondition',
            expression: {
              kind: 'JessieExpression',
              expression: 'cond',
            },
          },
          statements: [
            {
              kind: 'OutcomeStatement',
              condition: {
                kind: 'StatementCondition',
                expression: {
                  kind: 'JessieExpression',
                  expression: 'cond',
                },
              },
              isError: false,
              terminateFlow: false,
              value: {
                kind: 'ObjectLiteral',
                fields: [
                  {
                    kind: 'Assignment',
                    key: ['foo'],
                    value: {
                      kind: 'PrimitiveLiteral',
                      value: 1,
                    },
                  },
                ],
              },
            },
            {
              kind: 'OutcomeStatement',
              condition: {
                kind: 'StatementCondition',
                expression: {
                  kind: 'JessieExpression',
                  expression: 'cond',
                },
              },
              isError: false,
              terminateFlow: true,
              value: {
                kind: 'ObjectLiteral',
                fields: [
                  {
                    kind: 'Assignment',
                    key: ['foo'],
                    value: {
                      kind: 'PrimitiveLiteral',
                      value: 1,
                    },
                  },
                ],
              },
            },
            {
              kind: 'OutcomeStatement',
              condition: {
                kind: 'StatementCondition',
                expression: {
                  kind: 'JessieExpression',
                  expression: 'cond',
                },
              },
              isError: true,
              terminateFlow: false,
              value: {
                kind: 'ObjectLiteral',
                fields: [
                  {
                    kind: 'Assignment',
                    key: ['foo.bar'],
                    value: {
                      kind: 'PrimitiveLiteral',
                      value: 1,
                    },
                  },
                ],
              },
            },
            {
              kind: 'OutcomeStatement',
              condition: {
                kind: 'StatementCondition',
                expression: {
                  kind: 'JessieExpression',
                  expression: 'cond',
                },
              },
              isError: true,
              terminateFlow: true,
              value: {
                kind: 'ObjectLiteral',
                fields: [
                  {
                    kind: 'Assignment',
                    key: ['foo', 'bar'],
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
          kind: 'HttpCallStatement',
          method: 'GET',
          url: '/api/{foo}/bar',
          request: {
            kind: 'HttpRequest',
            contentType: 'application/json',
            query: {
              kind: 'ObjectLiteral',
              fields: [
                {
                  kind: 'Assignment',
                  key: ['foo'],
                  value: {
                    kind: 'PrimitiveLiteral',
                    value: 'hello',
                  },
                },
                {
                  kind: 'Assignment',
                  key: ['bar'],
                  value: {
                    kind: 'PrimitiveLiteral',
                    value: 'world',
                  },
                },
              ],
            },
            headers: {
              kind: 'ObjectLiteral',
              fields: [
                {
                  kind: 'Assignment',
                  key: ['User-Agent'],
                  value: {
                    kind: 'PrimitiveLiteral',
                    value: 'superface v1',
                  },
                },
              ],
            },
            body: {
              kind: 'ObjectLiteral',
              fields: [
                {
                  kind: 'Assignment',
                  key: ['foo'],
                  value: {
                    kind: 'PrimitiveLiteral',
                    value: 1,
                  },
                },
                {
                  kind: 'Assignment',
                  key: ['bar'],
                  value: {
                    kind: 'JessieExpression',
                    expression: '1 + 1',
                  },
                },
                {
                  kind: 'Assignment',
                  key: ['foo.bar', 'bar'],
                  value: {
                    kind: 'PrimitiveLiteral',
                    value: '3',
                  },
                },
              ],
            },
          },
          responseHandlers: [
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
                        key: ['foo'],
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
              contentType: 'application/json',
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
                        key: ['foo'],
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
              contentLanguage: 'en-US',
              statements: [
                {
                  kind: 'OutcomeStatement',
                  isError: false,
                  terminateFlow: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['foo'],
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
              statements: [
                {
                  kind: 'OutcomeStatement',
                  isError: true,
                  terminateFlow: true,
                  value: {
                    kind: 'ObjectLiteral',
                    fields: [
                      {
                        kind: 'Assignment',
                        key: ['foo'],
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
        {
          kind: 'HttpCallStatement',
          method: 'POST',
          url: '/',
          request: {
            kind: 'HttpRequest',
            body: {
              kind: 'JessieExpression',
              expression: '[1, 2, 3]',
            },
          },
          responseHandlers: [
            {
              kind: 'HttpResponseHandler',
              statusCode: 404,
              contentType: 'text/html',
              contentLanguage: 'en-US',
              statements: [
                {
                  kind: 'SetStatement',
                  assignments: [
                    {
                      kind: 'Assignment',
                      key: ['foo'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 1,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('map strict', () => {
  describe('jessie contexts', () => {
    it('should parse jessie condition expression', () => {
      const input = 'if ((() => { const a = 1; return { foo: a + 2 }; })())';

      const source = new Source(input);
      const condition = parseRule(mapCommon.STATEMENT_CONDITION, source, true);

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

      const objectStrict = parseRule(mapStrict.OBJECT_LITERAL, source, true);
      expect(objectStrict).toMatchObject({
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

    it('should parse jessie rhs in operation call arguments', () => {
      const input =
        'foo = "hi", bar = 1 + 2, baz = `format ${formatMe + `${nested}`} and ${formatThat} please`, quz = true )';

      const source = new Source(input);

      const args = parseRule(
        SyntaxRule.repeat(mapStrict.ARGUMENT_LIST_ASSIGNMENT),
        source,
        true
      );

      expect(args).toMatchObject([
        {
          kind: 'Assignment',
          key: ['foo'],
          value: {
            kind: 'PrimitiveLiteral',
            value: 'hi',
          },
        },
        {
          kind: 'Assignment',
          key: ['bar'],
          value: {
            kind: 'JessieExpression',
            expression: '1 + 2',
          },
        },
        {
          kind: 'Assignment',
          key: ['baz'],
          value: {
            kind: 'JessieExpression',
            expression:
              '"format " + (formatMe + ("" + nested)) + " and " + formatThat + " please"',
          },
        },
        {
          kind: 'Assignment',
          key: ['quz'],
          value: {
            kind: 'PrimitiveLiteral',
            value: true,
          },
        },
      ]);
    });
  });

  it('should parse the spec, only the spec and nothing but the spec in strict mode', () => {
    const input = STRICT_MAP;
    const source = new Source(input);
    const map = parseMap(source);
    expect(map).toMatchObject(STRICT_MAP_AST);
  });
});

describe('map extended', () => {
  it('should parse the strict example', () => {
    const input = STRICT_MAP;
    const source = new Source(input);
    const map = parseMapExtended(source);
    expect(map).toMatchObject(STRICT_MAP_AST);
  });
});
