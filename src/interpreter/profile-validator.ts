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
  DocumentDefinition,
} from '@superindustries/language';
import { ProfileVisitor } from '@superindustries/superface';

function assertUnreachable(node: never): never;
function assertUnreachable(node: ProfileASTNode): never {
  throw new Error(`Invalid Node kind: ${node.kind}`);
}

/**
 * @type Type - represents all possible Structures + undefined
 */
type Type =
  | undefined
  | PrimitiveStructure
  | EnumStructure
  | NonNullStructure
  | ModelStructure
  | ListStructure
  | ObjectStructure
  | UnionStructure;
/**
 * @type TypeValue - represents three primitive types
 */
type TypeValue = 'string' | 'number' | 'boolean';
/**
 * @interface PrimitiveStructure represents primitive type
 */
interface PrimitiveStructure {
  primitiveType: TypeValue | TypeValue[];
}
/**
 * @interface EnumStructure represent enum type
 * NOTE: When assigning enum keys to some values, the initial keys are not parsed
 */
interface EnumStructure {
  [enumValue: string]: undefined | string | number | boolean;
}
/**
 * @interface NonNullStructure represent type that is !required
 */
interface NonNullStructure {
  required: true;
  requiredType: Exclude<Type, NonNullStructure>;
}
/**
 * @interface ListStructure represent []list structure which can have one or more unioned types
 */
interface ListStructure {
  [listItem: number]: Type;
}
/**
 * @interface ObjectStructure represent any {}object structure
 */
interface ObjectStructure {
  [fieldName: string]: Type;
}
/**
 * @interface ModelStructure represent model structure
 */
type ModelStructure = {
  modelType: Type;
};
/**
 * @interface UnionStructure represent |union structure
 */
interface UnionStructure {
  [key: number]: Exclude<Type, UnionStructure>;
}

type ResultValidationObject = Type;
type InputValidationObject = ObjectStructure;
type ErrorValidationObject = Type;
type AsyncValidationObject = Type;

/**
 * @type ProfileVariables - represents valid usecase structure
 */
type ProfileVariables = (
  | {
      input: InputValidationObject;
      result: ResultValidationObject;
    }
  | {
      result: ResultValidationObject;
    }
) & {
  useCaseName: string;
  async?: AsyncValidationObject;
  error?: ErrorValidationObject;
};

/**
 * @interface ProfileOutput - represent profile output for next validation
 */
export interface ProfileOutput {
  profileId: string;
  usecase: ProfileVariables; // extend for safety and other slots
}

// type ProfileParameterKind = 'input' | 'result';

export class ProfileValidator implements ProfileVisitor {
  // private variableStack: Variables[] = [this.fields, this.models];
  private fields: ObjectStructure = {};
  private models: Record<string, ModelStructure> = {};

  visit(node: PrimitiveTypeNameNode): PrimitiveStructure;
  visit(node: EnumValueNode): string | number | boolean;
  visit(node: EnumDefinitionNode): EnumStructure;
  visit(node: UnionDefinitionNode): UnionStructure;
  visit(node: NonNullDefinitionNode): NonNullStructure;
  visit(node: ListDefinitionNode): ListStructure;
  visit(node: ObjectDefinitionNode): ObjectStructure;
  visit(node: UseCaseDefinitionNode): ProfileVariables;
  visit(node: ModelTypeNameNode | NamedModelDefinitionNode): ModelStructure;
  visit(node: NamedFieldDefinitionNode | FieldDefinitionNode): Type;
  visit(node: ProfileNode | ProfileIdNode): string;
  visit(node: ProfileDocumentNode): ProfileOutput;
  visit(
    node: ProfileASTNode
  ):
    | undefined
    | ProfileOutput
    | ProfileVariables
    | Type
    | ProfileVariables
    | string
    | number
    | boolean;
  visit(
    node: ProfileASTNode
  ):
    | undefined
    | ProfileOutput
    | ProfileVariables
    | Type
    | string
    | number
    | boolean {
    switch (node.kind) {
      case 'EnumDefinition':
        return this.visitEnumDefinitionNode(node);
      case 'EnumValue':
        return this.visitEnumValueNode(node);
      case 'FieldDefinition':
        return this.visitFieldDefinitionNode(node);
      case 'ListDefinition':
        return this.visitListDefinitionNode(node);
      case 'ModelTypeName':
        return this.visitModelTypeNameNode(node);
      case 'NamedFieldDefinition':
        return this.visitNamedFieldDefinitionNode(node);
      case 'NamedModelDefinition':
        return this.visitNamedModelDefinitionNode(node);
      case 'NonNullDefinition':
        return this.visitNonNullDefinitionNode(node);
      case 'ObjectDefinition':
        return this.visitObjectDefinitionNode(node);
      case 'PrimitiveTypeName':
        return this.visitPrimitiveTypeNameNode(node);
      case 'ProfileDocument':
        return this.visitProfileDocumentNode(node);
      case 'ProfileId':
        return this.visitProfileIdNode(node);
      case 'Profile':
        return this.visitProfileNode(node);
      case 'UnionDefinition':
        return this.visitUnionDefinitionNode(node);
      case 'UseCaseDefinition':
        return this.visitUseCaseDefinitionNode(node);

      default:
        assertUnreachable(node);
    }
  }

  visitEnumDefinitionNode(node: EnumDefinitionNode): EnumStructure {
    let enumeration: EnumStructure = {};
    node.values.forEach((enumValue: EnumValueNode) => {
      if (typeof enumValue.value === 'string') {
        enumeration[enumValue.value] = this.visit(enumValue);
      }
    });
    return enumeration;
  }

  visitEnumValueNode(node: EnumValueNode): string | number | boolean {
    return node.value;
  }

  visitFieldDefinitionNode(node: FieldDefinitionNode): Type {
    if (node.type === undefined) {
      return this.fields[node.fieldName];
    }
    return this.visit(node.type) as Type;
  }

  visitListDefinitionNode(node: ListDefinitionNode): ListStructure {
    return this.visit(node.elementType) as ListStructure;
  }

  visitModelTypeNameNode(node: ModelTypeNameNode): ModelStructure {
    const modelType = this.models[node.name];

    if (modelType === undefined) {
      return {
        modelType: undefined,
      };
    }

    return modelType;
  }

  visitNamedFieldDefinitionNode(node: NamedFieldDefinitionNode): Type {
    const fieldName = node.fieldName;
    let type = undefined;

    if (node.type !== undefined) {
      type = this.visit(node.type);
    }

    this.fields[fieldName] = type as Type;

    return type as Type;
  }

  visitNamedModelDefinitionNode(
    node: NamedModelDefinitionNode
  ): ModelStructure {
    const modelName = node.modelName;
    let type = undefined;

    if (node.type !== undefined) {
      type = this.visit(node.type);
    }

    this.models[modelName] = type as ModelStructure;

    return type as ModelStructure;
  }

  visitNonNullDefinitionNode(node: NonNullDefinitionNode): NonNullStructure {
    return {
      required: true,
      requiredType: this.visit(node.type) as Exclude<Type, NonNullStructure>,
    };
  }

  visitObjectDefinitionNode(node: ObjectDefinitionNode): ObjectStructure {
    let obj: ObjectStructure = {};

    node.fields.forEach((field: FieldDefinitionNode) => {
      obj[field.fieldName] = this.visit(field);
    });

    return obj;
  }

  visitPrimitiveTypeNameNode(node: PrimitiveTypeNameNode): PrimitiveStructure {
    return {
      primitiveType: node.name,
    };
  }

  visitProfileDocumentNode(node: ProfileDocumentNode): ProfileOutput {
    const profileId: string = this.visit(node.profile);
    let usecase: ProfileVariables = {
      useCaseName: '',
      input: {},
      result: {},
    };

    node.definitions.sort((a, b) => {
      if (a.kind === 'UseCaseDefinition') {
        return 1;
      } else if (
        a.kind === 'NamedModelDefinition' &&
        b.kind !== 'UseCaseDefinition'
      ) {
        return 1;
      } else {
        return -1;
      }
    });

    node.definitions.forEach((def: DocumentDefinition) => {
      if ('useCaseName' in def) {
        usecase = this.visit(def);
      } else {
        this.visit(def);
      }
    });

    return {
      profileId,
      usecase,
    };
  }

  visitProfileIdNode(node: ProfileIdNode): string {
    return node.profileId;
  }

  visitProfileNode(node: ProfileNode): string {
    return this.visit(node.profileId);
  }

  visitUnionDefinitionNode(node: UnionDefinitionNode): UnionStructure {
    let union: UnionStructure = [];
    node.types.forEach((type, i) => {
      union[i] = this.visit(type) as Exclude<Type, UnionStructure>;
    });
    return union;
  }

  visitUseCaseDefinitionNode(node: UseCaseDefinitionNode): ProfileVariables {
    const useCaseName = node.useCaseName;
    let input: ObjectStructure = {};
    let result: Type = {};

    if (node.input !== undefined) {
      input = this.visit(node.input) as ObjectStructure;
    }
    if (node.result !== undefined) {
      result = this.visit(node.result) as Type;
    }

    return {
      useCaseName,
      input,
      result,
    };
  }
}
