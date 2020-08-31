import {
  MapDefinitionNode,
  MapDocumentNode,
  MapNode,
  MapProfileIdNode,
  OperationDefinitionNode,
  ProviderNode,
} from '@superindustries/language';

import { SyntaxRule, SyntaxRuleSeparator } from '../rule';
import { documentedNode, SrcNode, SyntaxRuleSrc } from './common';

// OPERATION DEFINITION //

export const OPERATION_DEFINITION: SyntaxRuleSrc<OperationDefinitionNode> = documentedNode(
  SyntaxRule.identifier('operator')
    .followedBy(SyntaxRule.identifier())
    .andBy(SyntaxRule.separator('{'))
    .andBy(SyntaxRule.separator('}'))
    .map(
      (matches): SrcNode<OperationDefinitionNode> => {
        const [
          ,
          ,
          ,/* opKey */
        /* name */
        /* sepStart */
        /* sepEnd */
        ] = matches;

        throw 'TODO';
        // return {
        //   kind: 'OperationDefinition',
        //   operationName: name.data.identifier,
        //   location: opKey.location,
        //   span: { start: opKey.span.start, end: sepEnd.span.end }
        // }
      }
    )
);

// MAP DEFINITION //

export const MAP_DEFINITION: SyntaxRuleSrc<MapDefinitionNode> = documentedNode(
  SyntaxRule.identifier('map')
    .followedBy(SyntaxRule.identifier())
    .andBy(SyntaxRule.separator('{'))
    .andBy(SyntaxRule.separator('}'))
    .map(
      (matches): SrcNode<MapDefinitionNode> => {
        const [
          ,
          ,
          ,/* mapKey */
        /* name */
        /* sepStart */
        /* sepEnd */
        ] = matches;

        throw 'TODO';
        // return {
        //   kind: 'MapDefinition',
        //   mapName: name.data.identifier,
        //   location: mapKey.location,
        //   span: { start: mapKey.span.start, end: sepEnd.span.end }
        // }
      }
    )
);

// DOCUMENT //

/** `profile = string` */
export const PROFILE_ID: SyntaxRuleSrc<MapProfileIdNode> = SyntaxRule.identifier(
  'profile'
)
  .followedBy(SyntaxRuleSeparator.operator('='))
  .andBy(SyntaxRule.string())
  .map(
    (matches): SrcNode<MapProfileIdNode> => {
      const [keyword /* op */, , profileId] = matches;

      return {
        kind: 'ProfileId',
        profileId: profileId.data.string,
        location: keyword.location,
        span: { start: keyword.span.start, end: profileId.span.end },
      };
    }
  );

/** `provider = string` */
export const PROVIDER_ID: SyntaxRuleSrc<ProviderNode> = SyntaxRule.identifier(
  'provider'
)
  .followedBy(SyntaxRuleSeparator.operator('='))
  .andBy(SyntaxRule.string())
  .map(
    (matches): SrcNode<ProviderNode> => {
      const [keyword /* op */, , providerId] = matches;

      return {
        kind: 'Provider',
        providerId: providerId.data.string,
        location: keyword.location,
        span: { start: keyword.span.start, end: providerId.span.end },
      };
    }
  );

export const MAP: SyntaxRuleSrc<MapNode> = documentedNode(
  PROFILE_ID.followedBy(PROVIDER_ID).map(
    (matches): SrcNode<MapNode> => {
      const [profileId, provider] = matches;

      return {
        kind: 'Map',
        profileId,
        provider,
        location: profileId.location,
        span: { start: profileId.span.start, end: provider.span.end },
      };
    }
  )
);

export const DOCUMENT_DEFINITION: SyntaxRuleSrc<
  MapDefinitionNode | OperationDefinitionNode
> = MAP_DEFINITION.or(OPERATION_DEFINITION);

export const MAP_DOCUMENT: SyntaxRuleSrc<MapDocumentNode> = SyntaxRule.separator(
  'SOF'
)
  .followedBy(MAP)
  .andBy(SyntaxRule.optional(SyntaxRule.repeat(DOCUMENT_DEFINITION)))
  .andBy(SyntaxRule.separator('EOF'))
  .map(
    (matches): SrcNode<MapDocumentNode> => {
      const [, /* SOF */ map, definitions /* EOF */] = matches;

      let spanEnd = map.span.end;
      if (definitions !== undefined) {
        spanEnd = definitions[definitions.length - 1].span.end;
      }

      return {
        kind: 'MapDocument',
        map,
        definitions: definitions ?? [],
        location: map.location,
        span: { start: map.span.start, end: spanEnd },
      };
    }
  );
