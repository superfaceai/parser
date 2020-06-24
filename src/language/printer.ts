import {
  ArgumentNode,
  ASTNode,
  BooleanValueNode,
  DirectiveDefinitionNode,
  DirectiveNode,
  DocumentNode,
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
  EnumValueDefinitionNode,
  EnumValueNode,
  FieldDefinitionNode,
  FieldNode,
  FloatValueNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  IntValueNode,
  ListTypeNode,
  ListValueNode,
  NamedTypeNode,
  NameNode,
  NonNullTypeNode,
  ObjectFieldNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  ObjectValueNode,
  OperationDefinitionNode,
  OperationTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  ScalarTypeExtensionNode,
  SchemaDefinitionNode,
  SchemaExtensionNode,
  SelectionSetNode,
  StringValueNode,
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
  VariableDefinitionNode,
  VariableNode,
} from './ast';
import { printBlockString } from './blockString';
import { visit } from './visitor';

function isMultiline(str: string): boolean {
  return str.includes('\n');
}

function hasMultilineItems(maybeArray?: string[]): boolean | undefined {
  return maybeArray && maybeArray.some(isMultiline);
}

function indent(maybeString?: string): string | undefined {
  return maybeString && '  ' + maybeString.replace(/\n/g, '\n  ');
}

/**
 * If maybeString is not null or empty, then wrap with start and end, otherwise
 * print an empty string.
 */
function wrap(start: string, maybeString?: string, end = ''): string {
  return maybeString ? start + maybeString + end : '';
}

/**
 * Given maybeArray, print an empty string if it is null or empty, otherwise
 * print all items together separated by separator if provided
 */
function join(
  maybeArray?: ReadonlyArray<string | undefined>,
  separator = ''
): string {
  return maybeArray?.filter(x => x).join(separator) ?? '';
}

function addDescription(cb: Function) {
  return (node: SchemaDefinitionNode): string =>
    join([node.description, cb(node)], '\n');
}

/**
 * Given array, print each item on its own line, wrapped in an
 * indented "{ }" block.
 */
function block(array: string[] | undefined): string {
  return array && array.length !== 0
    ? '{\n' + indent(join(array, '\n')) + '\n}'
    : '';
}

// TODO: provide better type coverage in future
const printDocASTReducer = {
  Name: (node: NameNode): string => node.value,
  Variable: (node: VariableNode): string => '$' + node.name,

  // Document

  Document: (node: DocumentNode): string =>
    join(
      node.definitions.map(definition => definition.toString()),
      '\n\n'
    ) + '\n',

  OperationDefinition(node: OperationDefinitionNode): string {
    const op = node.operation;
    const name = node.name;
    const varDefs = wrap(
      '(',
      join(
        node.variableDefinitions?.map(variableDefinition =>
          variableDefinition.toString()
        ),
        ', '
      ),
      ')'
    );
    const directives = join(
      node.directives?.map(directive => directive.toString()),
      ' '
    );
    const selectionSet = node.selectionSet;
    // Anonymous queries with no directives or variable definitions can use
    // the query short form.

    return !name && !directives && !varDefs && op === 'query'
      ? selectionSet.toString()
      : join(
          [
            op,
            join([name?.toString(), varDefs]),
            directives,
            selectionSet.toString(),
          ],
          ' '
        );
  },

  VariableDefinition: ({
    variable,
    type,
    defaultValue,
    directives,
  }: VariableDefinitionNode): string =>
    variable +
    ': ' +
    type +
    wrap(' = ', defaultValue?.toString()) +
    wrap(
      ' ',
      join(
        directives?.map(directive => directive.toString()),
        ' '
      )
    ),

  SelectionSet: ({ selections }: SelectionSetNode): string =>
    block(selections.map(selection => selection.toString())),

  Field: ({
    alias,
    name,
    arguments: args,
    directives,
    selectionSet,
  }: FieldNode): string =>
    join(
      [
        wrap('', alias?.toString(), ': ') +
          name +
          wrap(
            '(',
            join(
              args?.map(arg => arg.toString()),
              ', '
            ),
            ')'
          ),
        join(
          directives?.map(directive => directive.toString()),
          ' '
        ),
        selectionSet?.toString(),
      ],
      ' '
    ),

  Argument: ({ name, value }: ArgumentNode): string => name + ': ' + value,

  // Fragments

  FragmentSpread: ({ name, directives }: FragmentSpreadNode): string =>
    '...' +
    name +
    wrap(
      ' ',
      join(
        directives?.map(directive => directive.toString()),
        ' '
      )
    ),

  InlineFragment: ({
    typeCondition,
    directives,
    selectionSet,
  }: InlineFragmentNode): string =>
    join(
      [
        '...',
        wrap('on ', typeCondition?.toString()),
        join(
          directives?.map(directive => directive.toString()),
          ' '
        ),
        selectionSet.toString(),
      ],
      ' '
    ),

  FragmentDefinition: ({
    name,
    typeCondition,
    variableDefinitions,
    directives,
    selectionSet,
  }: FragmentDefinitionNode): string => {
    // Note: fragment variable definitions are experimental and may be changed
    // or removed in the future.
    return `fragment ${name}${wrap(
      '(',
      join(
        variableDefinitions?.map(variableDefinition =>
          variableDefinition.toString()
        ),
        ', '
      ),
      ')'
    )} on ${typeCondition} ${wrap(
      '',
      join(
        directives?.map(directive => directive.toString()),
        ' '
      ),
      ' '
    )}${selectionSet}`;
  },

  // Value
  IntValue: ({ value }: IntValueNode): string => value,
  FloatValue: ({ value }: FloatValueNode): string => value,
  StringValue: (
    { value, block: isBlockString }: StringValueNode,
    key: string
  ): string =>
    isBlockString
      ? printBlockString(value, key === 'description' ? '' : '  ')
      : JSON.stringify(value),
  BooleanValue: ({ value }: BooleanValueNode): string =>
    value ? 'true' : 'false',
  NullValue: (): string => 'null',
  EnumValue: ({ value }: EnumValueNode): string => value,
  ListValue: ({ values }: ListValueNode): string =>
    '[' +
    join(
      values.map(value => value.toString()),
      ', '
    ) +
    ']',
  ObjectValue: ({ fields }: ObjectValueNode): string =>
    '{' +
    join(
      fields.map(field => field.toString()),
      ', '
    ) +
    '}',
  ObjectField: ({ name, value }: ObjectFieldNode): string =>
    name + ': ' + value,

  // Directive

  Directive: ({ name, arguments: args }: DirectiveNode): string =>
    '@' +
    name +
    wrap(
      '(',
      join(
        args?.map(arg => arg.toString()),
        ', '
      ),
      ')'
    ),

  // Type

  NamedType: ({ name }: NamedTypeNode): string => name.toString(),
  ListType: ({ type }: ListTypeNode): string => '[' + type + ']',
  NonNullType: ({ type }: NonNullTypeNode): string => type + '!',

  // Type System Definitions

  SchemaDefinition: addDescription(
    ({ directives, operationTypes }: SchemaDefinitionNode) =>
      join(
        [
          'schema',
          join(
            directives?.map(directive => directive.toString()),
            ' '
          ),
          block(operationTypes.map(operationType => operationType.toString())),
        ],
        ' '
      )
  ),

  OperationTypeDefinition: ({
    operation,
    type,
  }: OperationTypeDefinitionNode): string => operation + ': ' + type,

  ScalarTypeDefinition: addDescription(
    ({ name, directives }: ScalarTypeDefinitionNode): string =>
      join(
        [
          'scalar',
          name.toString(),
          join(
            directives?.map(directive => directive.toString()),
            ' '
          ),
        ],
        ' '
      )
  ),

  ObjectTypeDefinition: addDescription(
    ({
      name,
      interfaces,
      directives,
      fields,
    }: ObjectTypeDefinitionNode): string =>
      join(
        [
          'type',
          name.toString(),
          wrap(
            'implements ',
            join(
              interfaces?.map(iface => iface.toString()),
              ' & '
            )
          ),
          join(
            directives?.map(directive => directive.toString()),
            ' '
          ),
          block(fields?.map(field => field.toString())),
        ],
        ' '
      )
  ),

  FieldDefinition: addDescription(
    ({
      name,
      arguments: args,
      type,
      directives,
    }: FieldDefinitionNode): string =>
      name +
      (hasMultilineItems(args?.map(arg => arg.toString()))
        ? wrap(
            '(\n',
            indent(
              join(
                args?.map(arg => arg.toString()),
                '\n'
              )
            ),
            '\n)'
          )
        : wrap(
            '(',
            join(
              args?.map(arg => arg.toString()),
              ', '
            ),
            ')'
          )) +
      ': ' +
      type +
      wrap(
        ' ',
        join(
          directives?.map(directive => directive.toString()),
          ' '
        )
      )
  ),

  InputValueDefinition: addDescription(
    ({
      name,
      type,
      defaultValue,
      directives,
    }: InputValueDefinitionNode): string =>
      join(
        [
          name + ': ' + type,
          wrap('= ', defaultValue?.toString()),
          join(
            directives?.map(directive => directive.toString()),
            ' '
          ),
        ],
        ' '
      )
  ),

  InterfaceTypeDefinition: addDescription(
    ({
      name,
      interfaces,
      directives,
      fields,
    }: InterfaceTypeDefinitionNode): string =>
      join(
        [
          'interface',
          name.toString(),
          wrap(
            'implements ',
            join(
              interfaces?.map(iface => iface.toString()),
              ' & '
            )
          ),
          join(
            directives?.map(directive => directive.toString()),
            ' '
          ),
          block(fields?.map(field => field.toString())),
        ],
        ' '
      )
  ),

  UnionTypeDefinition: addDescription(
    ({ name, directives, types }: UnionTypeDefinitionNode): string =>
      join(
        [
          'union',
          name.toString(),
          join(
            directives?.map(directive => directive.toString()),
            ' '
          ),
          types && types.length !== 0
            ? '= ' +
              join(
                types.map(typ => typ.toString()),
                ' | '
              )
            : '',
        ],
        ' '
      )
  ),

  EnumTypeDefinition: addDescription(
    ({ name, directives, values }: EnumTypeDefinitionNode): string =>
      join(
        [
          'enum',
          name.toString(),
          join(
            directives?.map(directive => directive.toString()),
            ' '
          ),
          block(values?.map(value => value.toString())),
        ],
        ' '
      )
  ),

  EnumValueDefinition: addDescription(
    ({ name, directives }: EnumValueDefinitionNode): string =>
      join(
        [
          name.toString(),
          join(
            directives?.map(directive => directive.toString()),
            ' '
          ),
        ],
        ' '
      )
  ),

  InputObjectTypeDefinition: addDescription(
    ({ name, directives, fields }: InputObjectTypeDefinitionNode): string =>
      join(
        [
          'input',
          name.toString(),
          join(
            directives?.map(directive => directive.toString()),
            ' '
          ),
          block(fields?.map(field => field.toString())),
        ],
        ' '
      )
  ),

  DirectiveDefinition: addDescription(
    ({
      name,
      arguments: args,
      repeatable,
      locations,
    }: DirectiveDefinitionNode): string =>
      'directive @' +
      name +
      (hasMultilineItems(args?.map(arg => arg.toString()))
        ? wrap(
            '(\n',
            indent(
              join(
                args?.map(arg => arg.toString()),
                '\n'
              )
            ),
            '\n)'
          )
        : wrap(
            '(',
            join(
              args?.map(arg => arg.toString()),
              ', '
            ),
            ')'
          )) +
      (repeatable ? ' repeatable' : '') +
      ' on ' +
      join(
        locations.map(location => location.toString()),
        ' | '
      )
  ),

  SchemaExtension: ({
    directives,
    operationTypes,
  }: SchemaExtensionNode): string =>
    join(
      [
        'extend schema',
        join(
          directives?.map(directive => directive.toString()),
          ' '
        ),
        block(operationTypes?.map(operationType => operationType.toString())),
      ],
      ' '
    ),

  ScalarTypeExtension: ({
    name,
    directives,
  }: ScalarTypeExtensionNode): string =>
    join(
      [
        'extend scalar',
        name.toString(),
        join(
          directives?.map(directive => directive.toString()),
          ' '
        ),
      ],
      ' '
    ),

  ObjectTypeExtension: ({
    name,
    interfaces,
    directives,
    fields,
  }: ObjectTypeExtensionNode): string =>
    join(
      [
        'extend type',
        name.toString(),
        wrap(
          'implements ',
          join(
            interfaces?.map(iface => iface.toString()),
            ' & '
          )
        ),
        join(
          directives?.map(directive => directive.toString()),
          ' '
        ),
        block(fields?.map(field => field.toString())),
      ],
      ' '
    ),

  InterfaceTypeExtension: ({
    name,
    interfaces,
    directives,
    fields,
  }: InterfaceTypeExtensionNode): string =>
    join(
      [
        'extend interface',
        name.toString(),
        wrap(
          'implements ',
          join(
            interfaces?.map(iface => iface.toString()),
            ' & '
          )
        ),
        join(
          directives?.map(directive => directive.toString()),
          ' '
        ),
        block(fields?.map(field => field.toString())),
      ],
      ' '
    ),

  UnionTypeExtension: ({
    name,
    directives,
    types,
  }: UnionTypeExtensionNode): string =>
    join(
      [
        'extend union',
        name.toString(),
        join(
          directives?.map(directive => directive.toString()),
          ' '
        ),
        types && types.length !== 0
          ? '= ' +
            join(
              types.map(typ => typ.toString()),
              ' | '
            )
          : '',
      ],
      ' '
    ),

  EnumTypeExtension: ({
    name,
    directives,
    values,
  }: EnumTypeExtensionNode): string =>
    join(
      [
        'extend enum',
        name.toString(),
        join(
          directives?.map(directive => directive.toString()),
          ' '
        ),
        block(values?.map(value => value.toString())),
      ],
      ' '
    ),

  InputObjectTypeExtension: ({
    name,
    directives,
    fields,
  }: InputObjectTypeExtensionNode): string =>
    join(
      [
        'extend input',
        name.toString(),
        join(
          directives?.map(directive => directive.toString()),
          ' '
        ),
        block(fields?.map(field => field.toString())),
      ],
      ' '
    ),
};

/**
 * Converts an AST into a string, using one set of reasonable
 * formatting rules.
 */
export function print(ast: ASTNode): ASTNode {
  return visit(ast, { leave: printDocASTReducer as any });
}
