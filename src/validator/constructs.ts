import * as ts from 'typescript';

// Hint for forbidden construct attached to the report
export interface ForbiddenConstructHint {
  // Kind of the node for quick initial filtering
  kind: ts.SyntaxKind;
  // Should return true if this rule applies to given node.
  // The predicate can assume that the node is of `kind` type.
  //
  // If not specified, it is treated as if it always returned `true`.
  predicate?(node: ts.Node): boolean;
  // Hint to attach to the reporter error.
  hint: string;
}

// Forbidden syntax kinds with additional report hint
export const FORBIDDEN_CONSTRUCTS: Map<
  ts.SyntaxKind,
  ForbiddenConstructHint[]
> = new Map();

function registerForbiddenRules(rules: ForbiddenConstructHint[]): void {
  rules.forEach(rule => {
    if (!FORBIDDEN_CONSTRUCTS.has(rule.kind)) {
      FORBIDDEN_CONSTRUCTS.set(rule.kind, []);
    }

    FORBIDDEN_CONSTRUCTS.get(rule.kind)?.push(rule);
  });
}
registerForbiddenRules([
  {
    kind: ts.SyntaxKind.VariableDeclarationList,
    predicate: (node): boolean =>
      (node.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)) === 0,
    hint: 'Use const or let instead',
  },
  {
    kind: ts.SyntaxKind.FunctionDeclaration,
    hint: 'Use arrow functions instead',
  },
  {
    kind: ts.SyntaxKind.EqualsEqualsToken,
    hint: 'Use === instead',
  },
  {
    kind: ts.SyntaxKind.ExclamationEqualsToken,
    hint: 'Use !== instead',
  },
  {
    kind: ts.SyntaxKind.PrefixUnaryExpression,
    predicate: (node): boolean =>
      (node as ts.PrefixUnaryExpression).operator ===
      ts.SyntaxKind.PlusPlusToken,
    hint: 'Use += instead',
  },
  {
    kind: ts.SyntaxKind.PrefixUnaryExpression,
    predicate: (node): boolean =>
      (node as ts.PrefixUnaryExpression).operator ===
      ts.SyntaxKind.MinusMinusToken,
    hint: 'Use -= instead',
  },
  {
    kind: ts.SyntaxKind.PostfixUnaryExpression,
    predicate: (node): boolean =>
      (node as ts.PostfixUnaryExpression).operator ===
      ts.SyntaxKind.PlusPlusToken,
    hint: 'Use += instead',
  },
  {
    kind: ts.SyntaxKind.PostfixUnaryExpression,
    predicate: (node): boolean =>
      (node as ts.PostfixUnaryExpression).operator ===
      ts.SyntaxKind.MinusMinusToken,
    hint: 'Use -= instead',
  },
]);

// Explicitly allowed syntax, all other syntax kinds are rejected
export const ALLOWED_SYNTAX: Set<ts.SyntaxKind> = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EndOfFileToken,
  // ts.SyntaxKind.SingleLineCommentTrivia,
  // ts.SyntaxKind.MultiLineCommentTrivia,
  // ts.SyntaxKind.NewLineTrivia,
  // ts.SyntaxKind.WhitespaceTrivia,
  // ts.SyntaxKind.ShebangTrivia,
  // ts.SyntaxKind.ConflictMarkerTrivia,
  ts.SyntaxKind.NumericLiteral, // 1
  // ts.SyntaxKind.BigIntLiteral, // 1b
  ts.SyntaxKind.StringLiteral, // "hello"
  // ts.SyntaxKind.JsxText,
  // ts.SyntaxKind.JsxTextAllWhiteSpaces,
  // ts.SyntaxKind.RegularExpressionLiteral, // /.*/
  ts.SyntaxKind.NoSubstitutionTemplateLiteral, // `asdf`
  ts.SyntaxKind.TemplateHead, // `asdf ${
  ts.SyntaxKind.TemplateMiddle, // } asdf ${
  ts.SyntaxKind.TemplateTail, // } asdf`
  // ts.SyntaxKind.OpenBraceToken, // {
  // ts.SyntaxKind.CloseBraceToken, // }
  // ts.SyntaxKind.OpenParenToken, // (
  // ts.SyntaxKind.CloseParenToken, // )
  // ts.SyntaxKind.OpenBracketToken, // [
  // ts.SyntaxKind.CloseBracketToken, // ]
  // ts.SyntaxKind.DotToken, // .
  ts.SyntaxKind.DotDotDotToken, // ...
  // ts.SyntaxKind.SemicolonToken, // ;
  ts.SyntaxKind.CommaToken, // ,
  // ts.SyntaxKind.QuestionDotToken, // ?.
  ts.SyntaxKind.LessThanToken, // <
  // ts.SyntaxKind.LessThanSlashToken, // </
  ts.SyntaxKind.GreaterThanToken, // >
  ts.SyntaxKind.LessThanEqualsToken, // <=
  ts.SyntaxKind.GreaterThanEqualsToken, // >=
  // ts.SyntaxKind.EqualsEqualsToken, // ==
  // ts.SyntaxKind.ExclamationEqualsToken, // !=
  ts.SyntaxKind.EqualsEqualsEqualsToken, // ===
  ts.SyntaxKind.ExclamationEqualsEqualsToken, // !==
  ts.SyntaxKind.EqualsGreaterThanToken, // =>
  ts.SyntaxKind.PlusToken, // +
  ts.SyntaxKind.MinusToken, // -
  ts.SyntaxKind.AsteriskToken, // *
  ts.SyntaxKind.AsteriskAsteriskToken, // **
  ts.SyntaxKind.SlashToken, // /
  ts.SyntaxKind.PercentToken, // %
  // ts.SyntaxKind.PlusPlusToken, // ++
  // ts.SyntaxKind.MinusMinusToken, // --
  ts.SyntaxKind.LessThanLessThanToken, // <<
  ts.SyntaxKind.GreaterThanGreaterThanToken, // >>
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken, // >>>
  ts.SyntaxKind.AmpersandToken, // &
  ts.SyntaxKind.BarToken, // |
  ts.SyntaxKind.CaretToken, // ^
  ts.SyntaxKind.ExclamationToken, // !
  ts.SyntaxKind.TildeToken, // ~
  ts.SyntaxKind.AmpersandAmpersandToken, // &&
  ts.SyntaxKind.BarBarToken, // ||
  ts.SyntaxKind.QuestionToken, // ?
  ts.SyntaxKind.ColonToken, // :
  // ts.SyntaxKind.AtToken, // @
  // ts.SyntaxKind.QuestionQuestionToken, // ??
  // ts.SyntaxKind.BacktickToken, // ` - only produced in jsdoc, template strings are separate
  ts.SyntaxKind.EqualsToken, // =
  ts.SyntaxKind.PlusEqualsToken, // +=
  ts.SyntaxKind.MinusEqualsToken, // -=
  ts.SyntaxKind.AsteriskEqualsToken, // *=
  ts.SyntaxKind.SlashEqualsToken, // /=
  // TODO: Allow these?
  // ts.SyntaxKind.PercentEqualsToken, // %=
  // ts.SyntaxKind.LessThanLessThanEqualsToken, // <<=
  // ts.SyntaxKind.GreaterThanGreaterThanEqualsToken, // >>=
  // ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken, // >>>=
  // ts.SyntaxKind.AmpersandEqualsToken, // &=
  // ts.SyntaxKind.BarEqualsToken, // |=
  // ts.SyntaxKind.CaretEqualsToken, // ^=
  ts.SyntaxKind.Identifier, // asdf
  // ts.SyntaxKind.PrivateIdentifier, // ????
  // ts.SyntaxKind.BreakKeyword, // break
  // ts.SyntaxKind.CaseKeyword, // case
  // ts.SyntaxKind.CatchKeyword, // catch
  // ts.SyntaxKind.ConstKeyword, // const
  // ts.SyntaxKind.ContinueKeyword, // continue
  // ts.ScriptKind.DebuggerKeyword, // debugger
  // ts.SyntaxKind.DefaultKeyword, // default
  // ts.ScriptKind.DeleteKeyword, // delete
  // ts.SyntaxKind.DoKeyword, // do
  // ts.SyntaxKind.ElseKeyword, // else
  // ts.SyntaxKind.EnumKeyword, // enum
  // ts.SyntaxKind.ExportKeyword, // export
  // ts.SyntaxKind.ExtendsKeyword, // extends
  ts.SyntaxKind.FalseKeyword, // false
  // ts.SyntaxKind.FinallyKeyword, // finally
  // ts.SyntaxKind.ForKeyword, // for
  // ts.SyntaxKind.FunctionKeyword, // function
  // ts.SyntaxKind.IfKeyword, // if
  // ts.SyntaxKind.ImportKeyword, // import
  // ts.SyntaxKind.InKeyword, // in
  // ts.SyntaxKind.InstanceOfKeyword, // instanceof
  // ts.SyntaxKind.NewKeyword, // new
  ts.SyntaxKind.NullKeyword, // null
  // ts.SyntaxKind.ReturnKeyword, // return
  // ts.SyntaxKind.SuperKeyword, // super
  // ts.SyntaxKind.SwitchKeyword, // switch
  // ts.SyntaxKind.ThisKeyword, // this
  // ts.SyntaxKind.ThrowKeyword, // throw
  ts.SyntaxKind.TrueKeyword, // true
  // ts.SyntaxKind.TryKeyword, // try
  // ts.SyntaxKind.TypeOfKeyword, // typeof
  // ts.SyntaxKind.VarKeyword, // var
  // ts.SyntaxKind.VoidKeyword, // void
  // ts.SyntaxKind.WhileKeyword, // while
  // ts.SyntaxKind.WithKeyword, // with
  // ts.SyntaxKind.ImplementsKeyword, // implements
  // ts.SyntaxKind.InterfaceKeyword, // interface
  ts.SyntaxKind.LetKeyword, // let
  // ts.SyntaxKind.PackageKeyword, // package
  // ts.SyntaxKind.PrivateKeyword, // private
  // ts.SyntaxKind.ProtectedKeyword, // protected
  // ts.SyntaxKind.PublicKeyword, // public
  // ts.SyntaxKind.StaticKeyword, // static
  // ts.SyntaxKind.YieldKeyword, // yield
  // ts.SyntaxKind.AbstractKeyword, // abstract
  // ts.SyntaxKind.AsKeyword, // as
  // ts.SyntaxKind.AssertsKeyword, // asserts
  // ts.SyntaxKind.AnyKeyword, // any
  // ts.SyntaxKind.AsyncKeyword, // async
  // ts.SyntaxKind.AwaitKeyword, // await
  // ts.SyntaxKind.BooleanKeyword, // boolean
  // ts.SyntaxKind.ConstructorKeyword, // constructor
  // ts.SyntaxKind.DeclareKeyword, // declare
  // ts.SyntaxKind.GetKeyword, // get
  // ts.SyntaxKind.InferKeyword, // infer
  // ts.SyntaxKind.IsKeyword, // is
  // ts.SyntaxKind.KeyOfKeyword, // keyof
  // ts.SyntaxKind.ModuleKeyword, // module
  // ts.SyntaxKind.NamespaceKeyword, // namespace
  // ts.SyntaxKind.NeverKeyword, // never
  // ts.SyntaxKind.ReadonlyKeyword, // readonly
  // ts.SyntaxKind.RequireKeyword, // require
  // ts.SyntaxKind.NumberKeyword, // number
  // ts.SyntaxKind.ObjectKeyword, // object
  // ts.SyntaxKind.SetKeyword, // set
  // ts.SyntaxKind.StringKeyword, // string
  // ts.SyntaxKind.SymbolKeyword, // symbol
  // ts.SyntaxKind.TypeKeyword, // type
  ts.SyntaxKind.UndefinedKeyword, // undefined
  // ts.SyntaxKind.UniqueKeyword, // unique
  // ts.SyntaxKind.UnknownKeyword, // unknown
  // ts.SyntaxKind.FromKeyword, // from
  // ts.SyntaxKind.GlobalKeyword, // global
  // ts.SyntaxKind.BigIntKeyword, // bigint
  // ts.SyntaxKind.OfKeyword, // of
  // ts.SyntaxKind.QualifiedName, // ????
  // ts.SyntaxKind.ComputedPropertyName, // ????
  // ts.SyntaxKind.TypeParameter, // (arg: type, arg2: type2)
  ts.SyntaxKind.Parameter, // (arg, arg2)
  // ts.SyntaxKind.Decorator, // @decorator
  // ts.SyntaxKind.PropertySignature,
  // ts.SyntaxKind.PropertyDeclaration,
  // ts.SyntaxKind.MethodSignature,
  // ts.SyntaxKind.MethodDeclaration,
  // ts.SyntaxKind.Constructor,
  // ts.SyntaxKind.GetAccessor,
  // ts.SyntaxKind.SetAccessor,
  // ts.SyntaxKind.CallSignature,
  // ts.SyntaxKind.ConstructSignature,
  // ts.SyntaxKind.IndexSignature,
  // ts.SyntaxKind.TypePredicate,
  // ts.SyntaxKind.TypeReference,
  // ts.SyntaxKind.FunctionType,
  // ts.SyntaxKind.ConstructorType,
  // ts.SyntaxKind.TypeQuery,
  // ts.SyntaxKind.TypeLiteral,
  // ts.SyntaxKind.ArrayType, // type[]
  // ts.SyntaxKind.TupleType, // [type, type2]
  // ts.SyntaxKind.OptionalType, // type?
  // ts.SyntaxKind.RestType, // ident...
  // ts.SyntaxKind.UnionType, // type | type2
  // ts.SyntaxKind.IntersectionType, // type & type2
  // ts.SyntaxKind.ConditionalType, // cond ? type : type2
  // ts.SyntaxKind.InferType,
  // ts.SyntaxKind.ParenthesizedType,
  // ts.SyntaxKind.ThisType, // this
  // ts.SyntaxKind.TypeOperator,
  // ts.SyntaxKind.IndexedAccessType,
  // ts.SyntaxKind.MappedType,
  // ts.SyntaxKind.LiteralType,
  // ts.SyntaxKind.ImportType,
  ts.SyntaxKind.ObjectBindingPattern, // { a, b } = v
  ts.SyntaxKind.ArrayBindingPattern, // [a, b] = v
  ts.SyntaxKind.BindingElement, // { x, y, z }
  ts.SyntaxKind.ArrayLiteralExpression, // [a, b]
  ts.SyntaxKind.ObjectLiteralExpression, // { a: 1, b }
  ts.SyntaxKind.PropertyAccessExpression, // o.p
  ts.SyntaxKind.ElementAccessExpression, // a[i]
  ts.SyntaxKind.CallExpression, // ident()
  // ts.SyntaxKind.NewExpression, // new ident()
  // ts.SyntaxKind.TaggedTemplateExpression,
  // ts.SyntaxKind.TypeAssertionExpression, // a is type
  ts.SyntaxKind.ParenthesizedExpression, // (expr)
  // ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction, // (args) => body
  // ts.SyntaxKind.DeleteExpression, // delete expr
  // ts.SyntaxKind.TypeOfExpression, // typeof expr
  // ts.SyntaxKind.VoidExpression, // void
  // ts.SyntaxKind.AwaitExpression, // await expr
  ts.SyntaxKind.PrefixUnaryExpression, // OP expr
  ts.SyntaxKind.PostfixUnaryExpression, // expr OP
  ts.SyntaxKind.BinaryExpression, // expr OP expr
  ts.SyntaxKind.ConditionalExpression, // expr ? expr : expr
  ts.SyntaxKind.TemplateExpression, // `asdf ${expr} asdf`
  // ts.SyntaxKind.YieldExpression, // yield expr
  ts.SyntaxKind.SpreadElement,
  // ts.SyntaxKind.ClassExpression, // class ident { expr* }
  // ts.SyntaxKind.OmittedExpression,
  // ts.SyntaxKind.ExpressionWithTypeArguments,
  // ts.SyntaxKind.AsExpression, // x as type
  // ts.SyntaxKind.NonNullExpression, // x!!
  // ts.SyntaxKind.MetaProperty,
  // ts.SyntaxKind.SyntheticExpression,
  ts.SyntaxKind.TemplateSpan, // expr} asdf ${
  // ts.SyntaxKind.SemicolonClassElement,
  ts.SyntaxKind.Block,
  // ts.SyntaxKind.EmptyStatement, // ;
  ts.SyntaxKind.VariableStatement, // let/const/var ident = expr;
  ts.SyntaxKind.ExpressionStatement, // expr;
  ts.SyntaxKind.IfStatement, // if (expr) stmt else stmt
  ts.SyntaxKind.DoStatement, // do stmt while (expr)
  ts.SyntaxKind.WhileStatement, // while (expr) stmt
  ts.SyntaxKind.ForStatement, // for (stmt; expr; stmt) stmt
  // ts.SyntaxKind.ForInStatement, // for (var in expr) stmt
  ts.SyntaxKind.ForOfStatement, // for (var of expr) stmt
  ts.SyntaxKind.ContinueStatement, // continue
  ts.SyntaxKind.BreakStatement, // break
  ts.SyntaxKind.ReturnStatement, // return expr
  // ts.SyntaxKind.WithStatement, // with (expr) stmt
  ts.SyntaxKind.SwitchStatement, // switch(expr) stmt
  ts.SyntaxKind.LabeledStatement, // label: stmt
  // ts.SyntaxKind.ThrowStatement, // throw expr
  // ts.SyntaxKind.TryStatement, // try (expr) stmt catch (expr) stmt
  // ts.SyntaxKind.DebuggerStatement, // debugger
  ts.SyntaxKind.VariableDeclaration, // let/const/var ident = expr
  ts.SyntaxKind.VariableDeclarationList,
  // ts.SyntaxKind.FunctionDeclaration,
  // ts.SyntaxKind.ClassDeclaration,
  // ts.SyntaxKind.InterfaceDeclaration,
  // ts.SyntaxKind.TypeAliasDeclaration
  // ts.SyntaxKind.EnumDeclaration,
  // ts.SyntaxKind.ModuleDeclaration,
  // ts.SyntaxKind.ModuleBlock,
  ts.SyntaxKind.CaseBlock, // case expr: stmt
  // ts.SyntaxKind.NamespaceExportDeclaration,
  // ts.SyntaxKind.ImportEqualsDeclaration,
  // ts.SyntaxKind.ImportDeclaration,
  // ts.SyntaxKind.ImportClause, // import 'module'
  // ts.SyntaxKind.NamespaceImport,
  // ts.SyntaxKind.NamedImports,
  // ts.SyntaxKind.ImportSpecifier,
  // ts.SyntaxKind.ExportAssignment,
  // ts.SyntaxKind.ExportDeclaration,
  // ts.SyntaxKind.NamedExports,
  // ts.SyntaxKind.NamespaceExport,
  // ts.SyntaxKind.ExportSpecifier,
  // ts.SyntaxKind.MissingDeclaration,
  // ts.SyntaxKind.ExternalModuleReference,
  // ts.SyntaxKind.JsxElement,
  // ts.SyntaxKind.JsxSelfClosingElement,
  // ts.SyntaxKind.JsxOpeningElement,
  // ts.SyntaxKind.JsxClosingElement,
  // ts.SyntaxKind.JsxFragment,
  // ts.SyntaxKind.JsxOpeningFragment,
  // ts.SyntaxKind.JsxClosingFragment,
  // ts.SyntaxKind.JsxAttribute,
  // ts.SyntaxKind.JsxAttributes,
  // ts.SyntaxKind.JsxSpreadAttribute,
  // ts.SyntaxKind.JsxExpression,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.DefaultClause,
  // ts.SyntaxKind.HeritageClause,
  // ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.PropertyAssignment,
  // ts.SyntaxKind.ShorthandPropertyAssignment,
  ts.SyntaxKind.SpreadAssignment,
  // ts.SyntaxKind.EnumMember,
  // ts.SyntaxKind.UnparsedPrologue,
  // ts.SyntaxKind.UnparsedPrepend,
  // ts.SyntaxKind.UnparsedText,
  // ts.SyntaxKind.UnparsedInternalText,
  // ts.SyntaxKind.UnparsedSyntheticReference,
  ts.SyntaxKind.SourceFile,
  // ts.SyntaxKind.Bundle,
  // ts.SyntaxKind.UnparsedSource,
  // ts.SyntaxKind.InputFiles,
  // ts.SyntaxKind.JSDocTypeExpression,
  // ts.SyntaxKind.JSDocAllType,
  // ts.SyntaxKind.JSDocUnknownType,
  // ts.SyntaxKind.JSDocNullableType,
  // ts.SyntaxKind.JSDocNonNullableType,
  // ts.SyntaxKind.JSDocOptionalType,
  // ts.SyntaxKind.JSDocFunctionType,
  // ts.SyntaxKind.JSDocVariadicType,
  // ts.SyntaxKind.JSDocNamepathType,
  // ts.SyntaxKind.JSDocComment,
  // ts.SyntaxKind.JSDocTypeLiteral,
  // ts.SyntaxKind.JSDocSignature,
  // ts.SyntaxKind.JSDocTag,
  // ts.SyntaxKind.JSDocAugmentsTag,
  // ts.SyntaxKind.JSDocImplementsTag,
  // ts.SyntaxKind.JSDocAuthorTag,
  // ts.SyntaxKind.JSDocClassTag,
  // ts.SyntaxKind.JSDocPublicTag,
  // ts.SyntaxKind.JSDocPrivateTag,
  // ts.SyntaxKind.JSDocProtectedTag,
  // ts.SyntaxKind.JSDocReadonlyTag,
  // ts.SyntaxKind.JSDocCallbackTag,
  // ts.SyntaxKind.JSDocEnumTag,
  // ts.SyntaxKind.JSDocParameterTag,
  // ts.SyntaxKind.JSDocReturnTag,
  // ts.SyntaxKind.JSDocThisTag,
  // ts.SyntaxKind.JSDocTypeTag,
  // ts.SyntaxKind.JSDocTemplateTag,
  // ts.SyntaxKind.JSDocTypedefTag,
  // ts.SyntaxKind.JSDocPropertyTag,
  // ts.SyntaxKind.SyntaxList,
  // ts.SyntaxKind.NotEmittedStatement,
  // ts.SyntaxKind.PartiallyEmittedExpression,
  // ts.SyntaxKind.CommaListExpression,
  // ts.SyntaxKind.MergeDeclarationMarker,
  // ts.SyntaxKind.EndOfDeclarationMarker,
  // ts.SyntaxKind.SyntheticReferenceExpression,
  // ts.SyntaxKind.Count,
  ts.SyntaxKind.FirstAssignment,
  ts.SyntaxKind.LastAssignment,
  ts.SyntaxKind.FirstCompoundAssignment,
  ts.SyntaxKind.LastCompoundAssignment,
  ts.SyntaxKind.FirstReservedWord,
  ts.SyntaxKind.LastReservedWord,
  ts.SyntaxKind.FirstKeyword,
  ts.SyntaxKind.LastKeyword,
  ts.SyntaxKind.FirstFutureReservedWord,
  ts.SyntaxKind.LastFutureReservedWord,
  ts.SyntaxKind.FirstPunctuation,
  ts.SyntaxKind.LastPunctuation,
  ts.SyntaxKind.FirstToken,
  ts.SyntaxKind.LastToken,
  ts.SyntaxKind.FirstTriviaToken,
  ts.SyntaxKind.LastTriviaToken,
  ts.SyntaxKind.FirstLiteralToken,
  ts.SyntaxKind.LastLiteralToken,
  ts.SyntaxKind.FirstTemplateToken,
  ts.SyntaxKind.LastTemplateToken,
  ts.SyntaxKind.FirstBinaryOperator,
  ts.SyntaxKind.LastBinaryOperator,
  ts.SyntaxKind.FirstStatement,
  ts.SyntaxKind.LastStatement,
  ts.SyntaxKind.FirstNode,
  //   ts.SyntaxKind.FirstJSDocNode,
  //   ts.SyntaxKind.LastJSDocNode,
  //   ts.SyntaxKind.FirstJSDocTagNode,
  //   ts.SyntaxKind.LastJSDocTagNode,
]);
