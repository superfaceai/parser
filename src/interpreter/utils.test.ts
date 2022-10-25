import {
  AstMetadata,
  CallStatementNode,
  HttpCallStatementNode,
  OutcomeStatementNode,
  SetStatementNode,
} from '@superfaceai/ast';
import {
  ElementAccessExpression,
  Identifier,
  PropertyAccessExpression,
} from 'typescript';

import { isCompatible } from '.';
import { ScriptExpressionCompiler } from '../common/script';
import { getOutcomes, getVariableName } from './utils';

const mockASTGetter = jest.fn();
const mockParserGetter = jest.fn();

jest.mock('../metadata', () => ({
  parseMetadataVersion: jest.fn(),
  get PARSED_AST_VERSION(): jest.Mock {
    return mockASTGetter();
  },
  get PARSED_VERSION(): jest.Mock {
    return mockParserGetter();
  },
}));

describe('utils', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getOutcomes', () => {
    const OUTCOMES: OutcomeStatementNode[] = [
      {
        kind: 'OutcomeStatement',
        isError: true,
        terminateFlow: false,
        value: { kind: 'PrimitiveLiteral', value: 1 },
      },
      {
        kind: 'OutcomeStatement',
        isError: false,
        terminateFlow: false,
        value: { kind: 'PrimitiveLiteral', value: 2 },
      },
      {
        kind: 'OutcomeStatement',
        isError: true,
        terminateFlow: false,
        value: { kind: 'PrimitiveLiteral', value: 3 },
      },
      {
        kind: 'OutcomeStatement',
        isError: false,
        terminateFlow: false,
        value: { kind: 'PrimitiveLiteral', value: 4 },
      },
    ];
    const NESTED: [HttpCallStatementNode, CallStatementNode] = [
      {
        kind: 'HttpCallStatement',
        method: 'GET',
        url: '',
        responseHandlers: [
          {
            kind: 'HttpResponseHandler',
            statements: [OUTCOMES[2]],
          },
        ],
      },
      {
        kind: 'CallStatement',
        operationName: 'op',
        arguments: [],
        statements: [OUTCOMES[3]],
      },
    ];
    const OTHER: SetStatementNode = {
      kind: 'SetStatement',
      assignments: [],
    };

    it('returns all outcomes', () => {
      const outcomes = getOutcomes({
        kind: 'MapDefinition',
        name: 'd',
        usecaseName: 'd',
        statements: [OUTCOMES[0], OUTCOMES[1], NESTED[0], NESTED[1], OTHER],
      });

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
          statements: [OUTCOMES[0], OUTCOMES[1], NESTED[0], NESTED[1], OTHER],
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
          statements: [OUTCOMES[0], OUTCOMES[1], NESTED[0], NESTED[1], OTHER],
        },
        false
      );

      expect(outcomes).toHaveLength(2);
      expect(outcomes).toContain(OUTCOMES[1]);
      expect(outcomes).toContain(OUTCOMES[3]);
    });
  });

  describe('isCompatible', () => {
    const newMetadata: AstMetadata = {
      astVersion: {
        major: 3,
        minor: 1,
        patch: 0,
      },
      parserVersion: {
        major: 2,
        minor: 4,
        patch: 0,
      },
      sourceChecksum: '',
    };
    const oldMetaData: AstMetadata = {
      astVersion: {
        major: 0,
        minor: 1,
        patch: 0,
      },
      parserVersion: {
        major: 0,
        minor: 0,
        patch: 12,
      },
      sourceChecksum: '',
    };

    interface Version {
      major: number;
      minor: number;
      patch: number;
    }

    const getVersion = (
      major: number,
      minor?: number,
      patch?: number
    ): Version => ({
      major,
      minor: minor ?? 0,
      patch: patch ?? 0,
    });

    describe('returns false', () => {
      it('when specified AST is 0.1.0 and current AST version is 1.0.0', () => {
        mockASTGetter.mockReturnValue(getVersion(1, 0, 0));

        expect(isCompatible(oldMetaData)).toBeFalsy();
        expect(mockASTGetter).toHaveBeenCalledTimes(1);
      });

      it('when specified Parser is 0.0.12 and current Parser version is 1.0.0', () => {
        mockASTGetter.mockReturnValue(getVersion(0, 1, 0));
        mockParserGetter.mockReturnValue(getVersion(1, 0, 0));

        expect(isCompatible(oldMetaData)).toBeFalsy();
        expect(mockASTGetter).toHaveBeenCalledTimes(1);
        expect(mockParserGetter).toHaveBeenCalledTimes(1);
      });

      it('when specified AST is 3.1.0 and current AST version is 0.1.0', () => {
        mockASTGetter.mockReturnValue(getVersion(0, 1, 0));

        expect(isCompatible(newMetadata)).toBeFalsy();
      });

      it('when specified Parser is 2.4.0 and current Parser version is 1.0.0', () => {
        mockASTGetter.mockReturnValue(getVersion(3, 1, 0));
        mockParserGetter.mockReturnValue(getVersion(1, 0, 0));

        expect(isCompatible(newMetadata)).toBeFalsy();
      });
    });

    describe('returns true', () => {
      it('when specified AST and Parser have identical major versions in metadata', () => {
        mockASTGetter.mockReturnValue(getVersion(3, 0, 0));
        mockParserGetter.mockReturnValue(getVersion(2, 0, 0));

        expect(isCompatible(newMetadata)).toBeTruthy();
      });
    });
  });

  describe('getVariableName', () => {
    it('returns o for `o`', () => {
      const jessieExpression = new ScriptExpressionCompiler('o');
      const expr = jessieExpression.rawExpressionNode as Identifier;

      expect(getVariableName(expr)).toBe('o');
    });

    it('returns o.f1.f2 for `o.f1.f2`', () => {
      const jessieExpression = new ScriptExpressionCompiler('o.f1.f2');
      const expr =
        jessieExpression.rawExpressionNode as PropertyAccessExpression;

      expect(getVariableName(expr)).toBe('o.f1.f2');
    });

    it("returns o.f1.f2 for `o['f1']['f2']`", () => {
      const jessieExpression = new ScriptExpressionCompiler("o['f1']['f2']");
      const expr =
        jessieExpression.rawExpressionNode as ElementAccessExpression;

      expect(getVariableName(expr)).toBe('o.f1.f2');
    });

    it("returns o.f1.f2 for `o.f1.['f2']`", () => {
      const jessieExpression = new ScriptExpressionCompiler("o.f1['f2']");
      const expr =
        jessieExpression.rawExpressionNode as ElementAccessExpression;

      expect(getVariableName(expr)).toBe('o.f1.f2');
    });

    it("returns o.f1.f2 for `o['f1'].f2`", () => {
      const jessieExpression = new ScriptExpressionCompiler("o['f1'].f2");
      const expr =
        jessieExpression.rawExpressionNode as ElementAccessExpression;

      expect(getVariableName(expr)).toBe('o.f1.f2');
    });
  });
});
