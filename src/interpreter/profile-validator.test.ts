import { ProfileDocumentNode } from '@superindustries/language';
import { ProfileValidator } from './profile-validator';

describe('ProfileValidator', () => {
  describe('When Profile has no input', () => {
    const ast: ProfileDocumentNode = {
      kind: 'ProfileDocument',
      profile: {
        kind: 'Profile',
        profileId: {
          kind: 'ProfileId',
          profileId: 'whatever',
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
            kind: 'ObjectDefinition',
            fields: [
              {
                kind: 'FieldDefinition',
                fieldName: 'test',
                type: {
                  kind: 'ObjectDefinition',
                  fields: [
                    {
                      kind: 'FieldDefinition',
                      fieldName: 'hello',
                      type: {
                        kind: 'ObjectDefinition',
                        fields: [
                          {
                            kind: 'FieldDefinition',
                            fieldName: 'goodbye',
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
            ],
          },
        },
      ],
    };
    const profileValidator = new ProfileValidator();

    test('then somthing...', () => {
      expect(profileValidator.validate(ast, 'result', 'Test')).toMatchObject({
        ObjectDefinition: {
          result: {
            kind: 'ObjectDefinition',
            fields: [
              {
                kind: 'FieldDefinition',
                fieldName: 'test',
                type: {
                  kind: 'ObjectDefinition',
                  fields: [
                    {
                      kind: 'FieldDefinition',
                      fieldName: 'hello',
                      type: {
                        kind: 'ObjectDefinition',
                        fields: [
                          {
                            kind: 'FieldDefinition',
                            fieldName: 'goodbye',
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
            ],
          },
        },
      });
    });
  });
});
