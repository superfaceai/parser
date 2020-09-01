import { MapASTNode, ProfileDocumentNode } from '@superindustries/language';

import { MapValidator } from './map-validator';

const profile_ast: ProfileDocumentNode = {
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
    },
  ],
};

describe('MapValidator', () => {
  describe('when map has right properties', () => {
    const map_ast: MapASTNode = {
      kind: 'MapDocument',
      map: {
        kind: 'Map',
        profileId: {
          kind: 'ProfileId',
          profileId: 'hello!',
        },
        provider: {
          kind: 'Provider',
          providerId: 'hi!',
        },
      },
      definitions: [
        {
          kind: 'MapDefinition',
          mapName: 'testMap',
          usecaseName: 'testCase',
          variableExpressionsDefinition: [],
          stepsDefinition: [
            {
              kind: 'StepDefinition',
              variableExpressionsDefinition: [],
              stepName: 'oneAndOnlyStep',
              condition: {
                kind: 'JSExpression',
                expression: 'true',
              },
              iterationDefinition: {
                kind: 'IterationDefinition',
              },
              run: {
                kind: 'EvalDefinition',
                outcomeDefinition: {
                  kind: 'OutcomeDefinition',
                  returnDefinition: [
                    {
                      kind: 'MapExpressionsDefinition',
                      left: 'result',
                      right: {
                        kind: 'JSExpression',
                        expression: '12',
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    };
    const mapValidator = new MapValidator(profile_ast, map_ast);

    test('then map is valid for tested profile', () => {
      expect(mapValidator.validate()).toEqual(true);
    });
  });
});
