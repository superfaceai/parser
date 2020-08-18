import { Source } from './source';
import { parseProfile, parseRule } from './syntax/parser';
import * as rule from './syntax/rules/profile';
import { SyntaxRule } from './syntax/rules/rule';

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
      SyntaxRule.repeat(rule.DOCUMENT_DEFINITION),
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
          result: {
            kind: 'ObjectDefinition',
            fields: [
              {
                kind: 'FieldDefinition',
                fieldName: 'messageId',
              },
            ],
          },
          asyncResult: {
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
          error: {
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
      f1 enum { a b }
      f2 string 
      f3 {
        f3a
        f3b
      }
      f4 { f4a, f4b boolean }     # Ok with comma; however without comma -> error
      # f5 f6 f7                    # -> error (in formatter?)
      f8, f9, f10                 # -> OK
      # f11 string f12              # -> error (in formatter?)
      f13 string, f14             # -> OK
    }`;

    const source = new Source(input);
    const model = parseRule(rule.NAMED_MODEL_DEFINITION, source, true);

    expect(model).toMatchObject({
      kind: 'NamedModelDefinition',
      modelName: 'UWE',
      type: {
        kind: 'ObjectDefinition',
        fields: [
          // f1 enum { a b }
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
