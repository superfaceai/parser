import fs from 'fs';
import { join } from 'path';

import { Source } from './source';
import { parseMap, parseProfile, parseRule } from './syntax/parser';
import { SyntaxRule } from './syntax/rule';
import * as map from './syntax/rules/map';
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
    const input = `
    name = "conversation/send-message"
    version = "0.1.0"

    "Send single conversation message"
    usecase SendMessage unsafe {
      input {
        to
        from
        channel
        text
      }
    
      """  Title
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
        """ Problem
        Description of this field """
        problem
        """ Detail """
        detail
        " Instance whoop whoop

        "
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
    
    "
    Title of the field channel
    Description of the field channel
    "
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
      header: {
        kind: 'ProfileHeader',
        scope: 'conversation',
        name: 'send-message',
        version: {
          major: 0,
          minor: 1,
          patch: 0,
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
                  title: 'Problem',
                  description: 'Description of this field',
                },
                {
                  kind: 'FieldDefinition',
                  fieldName: 'detail',
                  title: 'Detail',
                },
                {
                  kind: 'FieldDefinition',
                  fieldName: 'instance',
                  title: 'Instance whoop whoop',
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
          title: 'Title of the field channel',
          description: 'Description of the field channel',
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
      f4 { f4a, f4b boolean }     // Ok with comma; however without comma -> error
      // f5 f6 f7                 // -> error
      f8, f9, f10                 // -> OK
      // f11 string f12           // -> error, missing comma
      f13 string, f14             // -> OK
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

const STRICT_MAP = fs
  .readFileSync(join('fixtures', 'strict.map.suma'))
  .toString('utf-8');
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const STRICT_MAP_AST: Record<string, unknown> = JSON.parse(
  fs.readFileSync(join('fixtures', 'strict.map.json')).toString('utf-8')
);

describe('map strict', () => {
  describe('jessie contexts', () => {
    it('should parse jessie condition expression', () => {
      const input = 'if ((() => { const a = 1; return { foo: a + 2 }; })())';

      const source = new Source(input);
      const condition = parseRule(map.common.CONDITION_ATOM, source, true);

      expect(condition).toMatchObject({
        kind: 'ConditionAtom',
        expression: {
          kind: 'JessieExpression',
          expression: '(function () { var a = 1; return { foo: a + 2 }; })()',
          source: '(() => { const a = 1; return { foo: a + 2 }; })()',
        },
      });
    });

    it('should parse iteration jessie epxression', () => {
      const input =
        'foreach (x of (() => { const x = [1, 2, 3]; x.push(4); return x; })())';

      const source = new Source(input);
      const condition = parseRule(map.common.ITERATION_ATOM, source, true);

      expect(condition).toMatchObject({
        kind: 'IterationAtom',
        iterationVariable: 'x',
        iterable: {
          kind: 'JessieExpression',
          expression:
            '(function () { var x = [1, 2, 3]; x.push(4); return x; })()',
          source: '(() => { const x = [1, 2, 3]; x.push(4); return x; })()',
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

      const objectStrict = parseRule(map.OBJECT_LITERAL, source, true);
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
        SyntaxRule.repeat(map.ARGUMENT_LIST_ASSIGNMENT),
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
