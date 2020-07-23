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
    field messageId String
    
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
          description: 'Send single conversation message',
        },
        {
          kind: 'UseCaseDefinition',
        },
        {
          kind: 'NamedFieldDefinition',
        },
        {
          kind: 'NamedFieldDefinition',
        },
        {
          kind: 'NamedFieldDefinition',
        },
      ],
    });
  });
});
