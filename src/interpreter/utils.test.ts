import { CallStatementNode, HttpCallStatementNode, OutcomeStatementNode, SetStatementNode } from "@superfaceai/ast";
import { getOutcomes } from "./utils";

describe('getOutcomes', () => {
  const OUTCOMES: OutcomeStatementNode[] = [
    {
      kind: 'OutcomeStatement',
      isError: true,
      terminateFlow: false,
      value: { kind: 'PrimitiveLiteral', value: 1 }
    },
    {
      kind: 'OutcomeStatement',
      isError: false,
      terminateFlow: false,
      value: { kind: 'PrimitiveLiteral', value: 2 }
    },
    {
      kind: 'OutcomeStatement',
      isError: true,
      terminateFlow: false,
      value: { kind: 'PrimitiveLiteral', value: 3 }
    },
    {
      kind: 'OutcomeStatement',
      isError: false,
      terminateFlow: false,
      value: { kind: 'PrimitiveLiteral', value: 4 }
    }
  ];
  const NESTED: [HttpCallStatementNode, CallStatementNode] = [
    {
      kind: 'HttpCallStatement',
      method: 'GET',
      url: '',
      responseHandlers: [
        {
          kind: 'HttpResponseHandler',
          statements: [
            OUTCOMES[2]
          ]
        }
      ]
    },
    {
      kind: 'CallStatement',
      operationName: 'op',
      arguments: [],
      statements: [
        OUTCOMES[3]
      ]
    }
  ];
  const OTHER: SetStatementNode = {
    kind: 'SetStatement',
    assignments: []
  };

  it('returns all outcomes', () => {
    const outcomes = getOutcomes(
      {
        kind: 'MapDefinition',
        name: 'd',
        usecaseName: 'd',
        statements: [
          OUTCOMES[0],
          OUTCOMES[1],
          NESTED[0],
          NESTED[1],
          OTHER
        ]
      }
    );
    
    expect(outcomes).toHaveLength(4);
    expect(outcomes).toContain(OUTCOMES[0]);
    expect(outcomes).toContain(OUTCOMES[1]);
    expect(outcomes).toContain(OUTCOMES[2]);
    expect(outcomes).toContain(OUTCOMES[3]);
  });

  it('returns error outcomes', () => {
    const outcomes = getOutcomes(
      {
        kind: 'MapDefinition',
        name: 'd',
        usecaseName: 'd',
        statements: [
          OUTCOMES[0],
          OUTCOMES[1],
          NESTED[0],
          NESTED[1],
          OTHER
        ]
      },
      true
    );
    
    expect(outcomes).toHaveLength(2);
    expect(outcomes).toContain(OUTCOMES[0]);
    expect(outcomes).toContain(OUTCOMES[2]);
  });

  it('returns non-error outcomes', () => {
    const outcomes = getOutcomes(
      {
        kind: 'MapDefinition',
        name: 'd',
        usecaseName: 'd',
        statements: [
          OUTCOMES[0],
          OUTCOMES[1],
          NESTED[0],
          NESTED[1],
          OTHER
        ]
      },
      false
    );
    
    expect(outcomes).toHaveLength(2);
    expect(outcomes).toContain(OUTCOMES[1]);
    expect(outcomes).toContain(OUTCOMES[3]);
  });
});
