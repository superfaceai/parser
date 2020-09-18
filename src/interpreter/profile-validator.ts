import {
  ProfileASTNode,
  EnumValueNode,
  ObjectDefinitionNode,
  FieldDefinitionNode,
  NamedFieldDefinitionNode,
  PrimitiveTypeNameNode,
  UseCaseDefinitionNode,
  UnionDefinitionNode,
  ProfileNode,
  ProfileIdNode,
  NamedModelDefinitionNode,
  ProfileDocumentNode,
  NonNullDefinitionNode,
  ModelTypeNameNode,
  ListDefinitionNode,
  EnumDefinitionNode,
} from '@superindustries/language';
// import { ProfileVisitor, Variables } from '@superindustries/superface';

function assertUnreachable(node: never): never;
function assertUnreachable(node: ProfileASTNode): never {
  throw new Error(`Invalid Node kind: ${node.kind}`);
}

// TODO? : create in @superface
type ResultValidationKind = {
  node: ObjectDefinitionNode | PrimitiveTypeNameNode | ModelTypeNameNode;
};
type InputValidationKind = {
  node: ObjectDefinitionNode;
};
interface ValidationVariables {
  [key: string]: ResultValidationKind | InputValidationKind;
}

type ProfileOutput = {
  profileId: ProfileIdNode;
  usecase: UseCaseDefinitionNode;
  profile:
    | { input: ValidationVariables }
    | { result: ValidationVariables }
    | {
        input: ValidationVariables;
        result: ValidationVariables;
      };
};

type ProfileParameterKind = 'input' | 'result';

export class ProfileValidator {
  constructor(private readonly output: ProfileOutput) {}

  // parsing a parameter ===
  visit(
    node: ProfileASTNode,
    kind: ProfileParameterKind,
    usecase: string
  ): ProfileOutput {
    switch (node.kind) {
      case 'EnumDefinition':
        return this.visitEnumDefinitionNode(node, kind, usecase);
      case 'EnumValue':
        return this.visitEnumValueNode(node, kind, usecase);
      case 'FieldDefinition':
        return this.visitFieldDefinitionNode(node, kind, usecase);
      case 'ListDefinition':
        return this.visitListDefinitionNode(node, kind, usecase);
      case 'ModelTypeName':
        return this.visitModelTypeNameNode(node, kind, usecase);
      case 'NamedFieldDefinition':
        return this.visitNamedFieldDefinitionNode(node, kind, usecase);
      case 'NamedModelDefinition':
        return this.visitNamedModelDefinitionNode(node, kind, usecase);
      case 'NonNullDefinition':
        return this.visitNonNullDefinitionNode(node, kind, usecase);
      case 'ObjectDefinition':
        return this.visitObjectDefinitionNode(node, kind, usecase);
      case 'PrimitiveTypeName':
        return this.visitPrimitiveTypeNameNode(node, kind, usecase);
      case 'ProfileDocument':
        return this.visitProfileDocumentNode(node, kind, usecase);
      case 'ProfileId':
        return this.visitProfileIdNode(node, kind, usecase);
      case 'Profile':
        return this.visitProfileNode(node, kind, usecase);
      case 'UnionDefinition':
        return this.visitUnionDefinitionNode(node, kind, usecase);
      case 'UseCaseDefinition':
        return this.visitUseCaseDefinitionNode(node, kind, usecase);

      default:
        assertUnreachable(node);
    }
  }

  visitEnumDefinitionNode(
    _node: EnumDefinitionNode,
    _kind: ProfileParameterKind,
    _usecase: string
  ): ProfileOutput {
    throw new Error('Method not implemented.');
  }

  visitEnumValueNode(
    _node: EnumValueNode,
    _kind: ProfileParameterKind,
    _usecase: string
  ): ProfileOutput {
    throw new Error('Method not implemented.');
  }

  visitFieldDefinitionNode(
    _node: FieldDefinitionNode,
    _kind: ProfileParameterKind,
    _usecase: string
  ): ProfileOutput {
    throw new Error('Method not implemented.');
  }

  visitListDefinitionNode(
    _node: ListDefinitionNode,
    _kind: ProfileParameterKind,
    _usecase: string
  ): ProfileOutput {
    throw new Error('Method not implemented.');
  }

  visitModelTypeNameNode(
    _node: ModelTypeNameNode,
    _kind: ProfileParameterKind,
    _usecase: string
  ): ProfileOutput {
    throw new Error('Method not implemented.');
  }

  visitNamedFieldDefinitionNode(
    _node: NamedFieldDefinitionNode,
    _kind: ProfileParameterKind,
    _usecase: string
  ): ProfileOutput {
    throw new Error('Method not implemented.');
  }

  visitNamedModelDefinitionNode(
    _node: NamedModelDefinitionNode,
    _kind: ProfileParameterKind,
    _usecase: string
  ): ProfileOutput {
    throw new Error('Method not implemented.');
  }

  visitNonNullDefinitionNode(
    _node: NonNullDefinitionNode,
    _kind: ProfileParameterKind,
    _usecase: string
  ): ProfileOutput {
    throw new Error('Method not implemented.');
  }

  visitObjectDefinitionNode(
    node: ObjectDefinitionNode,
    kind: ProfileParameterKind,
    usecase: string
  ): ProfileOutput {
    throw new Error('Method not implemented.');
    // if (input === undefined) {
    //   return {};
    // }
    // if (typeof input !== 'object' || input === null) {
    //   return [
    //     false,
    //     [
    //       {
    //         kind: 'wrongType',
    //         context: { expected: 'object', actual: typeof input },
    //       },
    //     ],
    //   ];
    // }
    // return {};
  }

  visitPrimitiveTypeNameNode(
    _node: PrimitiveTypeNameNode,
    _kind: ProfileParameterKind,
    _usecase: string
  ): ProfileOutput {
    throw new Error('Method not implemented.');
  }

  visitProfileDocumentNode(
    node: ProfileDocumentNode,
    kind: ProfileParameterKind,
    usecase: string
  ): ProfileOutput {
    // TODO
    throw new Error('Method not implemented.');
    // this.visit(node.definitions, kind, usecase);
  }

  visitProfileIdNode(
    _node: ProfileIdNode,
    _kind: ProfileParameterKind,
    _usecase: string
  ): ProfileOutput {
    throw new Error('Method not implemented.');
  }

  visitProfileNode(
    _node: ProfileNode,
    _kind: ProfileParameterKind,
    _usecase: string
  ): ProfileOutput {
    throw new Error('Method not implemented.');
  }

  visitUnionDefinitionNode(
    _node: UnionDefinitionNode,
    _kind: ProfileParameterKind,
    _usecase: string
  ): ProfileOutput {
    throw new Error('Method not implemented.');
  }

  visitUseCaseDefinitionNode(
    node: UseCaseDefinitionNode,
    kind: ProfileParameterKind,
    usecase: string
  ): ProfileOutput {
    throw new Error('Method not implemented.');
    //   if (kind === 'input' && node.input) {
    //     this.output.input = this.visit(node.input, kind, usecase);
    //   } else if (kind === 'result' && node.result) {
    //     this.output.result = this.visit(node.result, kind, usecase);
    //   }

    //   return this.output;
  }
}
