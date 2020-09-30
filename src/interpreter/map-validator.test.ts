import { MapASTNode, ProfileDocumentNode } from '@superindustries/language';

import { MapValidator } from './map-validator';
import { ProfileValidator } from './profile-validator';

describe('MapValidator', () => {
  describe('when profile has right structure', () => {
    describe('and result should be object within object', () => {
      const mapAst: MapASTNode = {
        kind: 'MapDocument',
        map: {
          kind: 'Map',
          profileId: {
            kind: 'ProfileId',
            profileId: 'whatever',
          },
          provider: {
            kind: 'Provider',
            providerId: 'whatever',
          },
        },
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'MapResultStatement',
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
                              value: 'inner string',
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
      const profileAst: ProfileDocumentNode = {
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
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
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
      const profileValidator = new ProfileValidator();
      const profileOutput = profileValidator.visit(profileAst);
      const mapValidator = new MapValidator(mapAst, profileOutput);
      test('then profile is able to be used with map', () => {
        expect(() =>
          mapValidator.validate(profileOutput.usecase?.result)
        ).not.toThrow();
      });
    });
    describe('and result should be ListDefinition and PrimitiveTypeName within object', () => {
      const mapAst: MapASTNode = {
        kind: 'MapDocument',
        map: {
          kind: 'Map',
          profileId: {
            kind: 'ProfileId',
            profileId: 'whatever',
          },
          provider: {
            kind: 'Provider',
            providerId: 'whatever',
          },
        },
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'MapResultStatement',
                value: {
                  kind: 'ObjectLiteral',
                  fields: [
                    {
                      kind: 'Assignment',
                      key: ['f1'],
                      value: {
                        kind: 'ArrayLiteral',
                        elements: [
                          {
                            kind: 'ObjectLiteral',
                            fields: [
                              {
                                kind: 'Assignment',
                                key: ['inner'],
                                value: {
                                  kind: 'PrimitiveLiteral',
                                  value: 'Age',
                                },
                              },
                            ],
                          },
                          {
                            kind: 'PrimitiveLiteral',
                            value: 25,
                          },
                        ],
                      },
                    },
                    {
                      kind: 'Assignment',
                      key: ['f2'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'F2',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      /**
       *  Notation:
       *  result {
       *   f1 [{inner string} | number]
       *   f2 string
       *  }
       */
      const profileAst: ProfileDocumentNode = {
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
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
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
                    fieldName: 'f1',
                    type: {
                      kind: 'ListDefinition',
                      elementType: {
                        kind: 'UnionDefinition',
                        types: [
                          {
                            kind: 'ObjectDefinition',
                            fields: [
                              {
                                kind: 'FieldDefinition',
                                required: false,
                                fieldName: 'inner',
                                type: {
                                  kind: 'PrimitiveTypeName',
                                  name: 'string',
                                },
                              },
                            ],
                          },
                          {
                            kind: 'PrimitiveTypeName',
                            name: 'number',
                          },
                        ],
                      },
                    },
                  },
                  {
                    kind: 'FieldDefinition',
                    required: false,
                    fieldName: 'f2',
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
      const profileValidator = new ProfileValidator();
      const profileOutput = profileValidator.visit(profileAst);
      const mapValidator = new MapValidator(mapAst, profileOutput);
      test('then profile is able to be used with map', () => {
        expect(() =>
          mapValidator.validate(profileOutput.usecase?.result)
        ).not.toThrow();
      });
    });
  });

  describe('when profile has wrong structure', () => {
    const mapAst: MapASTNode = {
      kind: 'MapDocument',
      map: {
        kind: 'Map',
        profileId: {
          kind: 'ProfileId',
          profileId: 'whatever',
        },
        provider: {
          kind: 'Provider',
          providerId: 'whatever',
        },
      },
      definitions: [
        {
          kind: 'MapDefinition',
          name: 'Test',
          usecaseName: 'Test',
          statements: [
            {
              kind: 'MapResultStatement',
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
                            value: 'inner string',
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
    describe('and result has wrong field names', () => {
      const profileAst: ProfileDocumentNode = {
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
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
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
                    fieldName: 'f2',
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
      const profileValidator = new ProfileValidator();
      const profileOutput = profileValidator.visit(profileAst);
      const mapValidator = new MapValidator(mapAst, profileOutput);
      test('then profile is not valid for map', () => {
        expect(() =>
          mapValidator.validate(profileOutput.usecase?.result)
        ).toThrow('Wrong Object Structure: expected f1, but got f2');
        // .toThrow('Wrong type: expected string, but got number');
      });
    });
    describe('and result has wrong type - PrimitiveTypeName', () => {
      const profileAst: ProfileDocumentNode = {
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
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
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
      const profileValidator = new ProfileValidator();
      const profileOutput = profileValidator.visit(profileAst);
      const mapValidator = new MapValidator(mapAst, profileOutput);
      test('then profile is not valid for map', () => {
        expect(() =>
          mapValidator.validate(profileOutput.usecase?.result)
        ).toThrow(
          'Wrong Structure: expected ObjectLiteral, but got PrimitiveStructure'
        );
      });
    });
    describe('and result has wrong type - ListDefinition', () => {
      const profileAst: ProfileDocumentNode = {
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
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
              },
            },
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
      const profileValidator = new ProfileValidator();
      const profileOutput = profileValidator.visit(profileAst);
      const mapValidator = new MapValidator(mapAst, profileOutput);
      test('then profile is not valid for map', () => {
        expect(() =>
          mapValidator.validate(profileOutput.usecase?.result)
        ).toThrow(
          'Wrong Structure: expected ObjectLiteral, but got ListStructure'
        );
      });
    });
    describe('and result should be ListDefinition and PrimitiveTypeName within object', () => {
      const mapAst: MapASTNode = {
        kind: 'MapDocument',
        map: {
          kind: 'Map',
          profileId: {
            kind: 'ProfileId',
            profileId: 'whatever',
          },
          provider: {
            kind: 'Provider',
            providerId: 'whatever',
          },
        },
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'MapResultStatement',
                value: {
                  kind: 'ObjectLiteral',
                  fields: [
                    {
                      kind: 'Assignment',
                      key: ['f1'],
                      value: {
                        kind: 'ArrayLiteral',
                        elements: [
                          {
                            kind: 'ObjectLiteral',
                            fields: [
                              {
                                kind: 'Assignment',
                                key: ['inner'],
                                value: {
                                  kind: 'PrimitiveLiteral',
                                  value: 'Age',
                                },
                              },
                            ],
                          },
                          {
                            kind: 'PrimitiveLiteral',
                            value: 25,
                          },
                        ],
                      },
                    },
                    {
                      kind: 'Assignment',
                      key: ['f2'],
                      value: {
                        kind: 'PrimitiveLiteral',
                        value: 'F2',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      /**
       *  Right Notation:
       *  result {
       *   f1 [{inner string} | number]
       *   f2 string
       *  }
       *  Right Notation ASWELL:
       *  result {
       *   f1 [{inner boolean} | number]
       *   f2 string
       *  }
       *
       *  Wrong Notation:
       *  result {
       *   f1 [{inner {}} | number]
       *   f2 string
       *  }
       *  result {
       *   f1 [{inner string} | number]
       *   f2 {}
       *  }
       *  result {
       *   f1 [{inner string} | number]
       *  }
       */
      const profileAst: ProfileDocumentNode = {
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
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
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
                    fieldName: 'f1',
                    type: {
                      kind: 'ListDefinition',
                      elementType: {
                        kind: 'UnionDefinition',
                        types: [
                          {
                            kind: 'ObjectDefinition',
                            fields: [
                              {
                                kind: 'FieldDefinition',
                                required: false,
                                fieldName: 'inner',
                                type: {
                                  kind: 'ObjectDefinition',
                                  fields: [],
                                },
                              },
                            ],
                          },
                          {
                            kind: 'PrimitiveTypeName',
                            name: 'number',
                          },
                        ],
                      },
                    },
                  },
                  {
                    kind: 'FieldDefinition',
                    required: false,
                    fieldName: 'f2',
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
      const profileValidator = new ProfileValidator();
      const profileOutput = profileValidator.visit(profileAst);
      const mapValidator = new MapValidator(mapAst, profileOutput);
      test('then profile is not valid for map', () => {
        expect(() =>
          mapValidator.validate(profileOutput.usecase?.result)
        ).toThrow(
          'Wrong Structure: expected PrimitiveLiteral, but got ObjectStructure'
        );
      });
    });
    describe('and result should contain two PrimitiveTypeNames within object', () => {
      const mapAst: MapASTNode = {
        kind: 'MapDocument',
        map: {
          kind: 'Map',
          profileId: {
            kind: 'ProfileId',
            profileId: 'whatever',
          },
          provider: {
            kind: 'Provider',
            providerId: 'whatever',
          },
        },
        definitions: [
          {
            kind: 'MapDefinition',
            name: 'Test',
            usecaseName: 'Test',
            statements: [
              {
                kind: 'MapResultStatement',
                value: {
                  kind: 'ObjectLiteral',
                  fields: [
                    {
                      kind: 'Assignment',
                      key: ['f1'],
                      value: { kind: 'PrimitiveLiteral', value: 'Age' },
                    },
                    {
                      kind: 'Assignment',
                      key: ['f2'],
                      value: { kind: 'PrimitiveLiteral', value: 25 },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      /**
       *  Right Notation:
       *  result {
       *   f1 string
       *   f2 number
       *  }
       *  Wrong Notation:
       *  result {
       *   f1 {}
       *   f2 [number]
       *  }
       *  result {
       *   f1 string
       *  }
       */
      const profileAst: ProfileDocumentNode = {
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
              kind: 'UseCaseSlotDefinition',
              type: {
                kind: 'ObjectDefinition',
                fields: [],
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
      const profileValidator = new ProfileValidator();
      const profileOutput = profileValidator.visit(profileAst);
      const mapValidator = new MapValidator(mapAst, profileOutput);
      test('then profile is not valid for map', () => {
        expect(() =>
          mapValidator.validate(profileOutput.usecase?.result)
        ).toThrow('Wrong Object Structure: expected f1, f2, but got f1');
      });
    });
  });
});
