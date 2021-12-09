import {
  AstMetadata,
  CallStatementNode,
  HttpCallStatementNode,
  OutcomeStatementNode,
  SetStatementNode,
} from '@superfaceai/ast';
import { mocked } from 'ts-jest/utils';

import { parseMetadataVersion } from '../metadata';
import { isCompatible } from '.';
import { getOutcomes } from './utils';

jest.mock('../metadata', () => ({
  ...jest.requireActual('../metadata'),
  parseMetadataVersion: jest.fn(),
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

    describe('returns false', () => {
      it('when specified AST is old and current AST version is newer', () => {
        const parseMetadataVersionSpy = mocked(
          parseMetadataVersion
        ).mockReturnValue({ major: 1, minor: 0, patch: 0 });

        expect(isCompatible(oldMetaData)).toBeFalsy();
        expect(parseMetadataVersionSpy).toBeCalledTimes(1);
      });

      it('when specified AST is old and current Parser version is newer', () => {
        // first call to get PARSED_AST_VERSION, another to PARSED_VERSION
        const parseMetadataVersionSpy = mocked(
          parseMetadataVersion
        ).mockReturnValueOnce({ major: 0, minor: 1, patch: 0 })
        .mockReturnValueOnce({ major: 1, minor: 0, patch: 0 });

        expect(isCompatible(oldMetaData)).toBeFalsy();
        expect(parseMetadataVersionSpy).toBeCalledTimes(2);
      });

      it('when specified AST is new and current AST version is older', () => {
        const parseMetadataVersionSpy = mocked(
          parseMetadataVersion
        ).mockReturnValueOnce({ major: 1, minor: 0, patch: 0 });

        expect(isCompatible(newMetadata)).toBeFalsy();
        expect(parseMetadataVersionSpy).toBeCalledTimes(1);
      });

      it('when specified AST is new and current Parser version is older', () => {
        const parseMetadataVersionSpy = mocked(parseMetadataVersion)
          .mockReturnValueOnce({ major: 3, minor: 1, patch: 0 })
          .mockReturnValueOnce({ major: 1, minor: 0, patch: 0 });

        expect(isCompatible(newMetadata)).toBeFalsy();
        expect(parseMetadataVersionSpy).toBeCalledTimes(2);
      });
    });

    describe('returns true', () => {
      it('when specified AST has identical major versions in metadata', () => {
        const parseMetadataVersionSpy = mocked(parseMetadataVersion)
          .mockReturnValueOnce({ major: 3, minor: 0, patch: 0 })
          .mockReturnValueOnce({ major: 2, minor: 0, patch: 0 });

        expect(isCompatible(newMetadata)).toBeTruthy();
        expect(parseMetadataVersionSpy).toBeCalledTimes(2);
      });
    });
  });
});
