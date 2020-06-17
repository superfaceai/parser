/* eslint-disable no-fallthrough */
import * as ts from "typescript";

export enum ValidationErrorType {
  ForbiddenConstruct,
}

export interface ValidationError {
  message: string;
  hint?: string;
  type: ValidationErrorType;
  position: {
    start: number;
    end: number;
  };
}

export class ScriptValidationReport {
  errors: ValidationError[] = [];

  public get isValid(): boolean {
    return this.errors.length == 0;
  }

  public addError(
    error: string,
    errorType: ValidationErrorType,
    node: ts.Node,
    hint?: string
  ): void {
    this.errors.push({
      message: error,
      type: errorType,
      hint: hint,
      position: {
        start: node.pos,
        end: node.end,
      },
    });
  }
}

export class SuperfaceScriptValidator {
  public readonly report: ScriptValidationReport;
  constructor() {
    this.report = new ScriptValidationReport();
  }

  validate = (js: string): ScriptValidationReport => {
    const sourceNode = this.parse(js);
    this.validateNode(sourceNode);

    return this.report;
  };

  private parse = (js: string): ts.SourceFile => {
    const sourceFile = ts.createSourceFile(
      "scripts.js",
      js,
      ts.ScriptTarget.ES2015,
      true,
      ts.ScriptKind.JS
    );

    return sourceFile;
  };

  private validateNode = (node: ts.Node): void => {
    this.checkForForbiddenConstructs(node);
    ts.forEachChild(node, this.validateNode);
  };

  private checkForForbiddenConstructs = (node: ts.Node): void => {
    const reportError = (node: ts.Node): void => {
      this.report.addError(
        `${ts.SyntaxKind[node.kind]} construct is not supported`,
        ValidationErrorType.ForbiddenConstruct,
        node,
        this.getHintForForbiddenConstruct(node)
      );
    };

    switch (node.kind) {
      case ts.SyntaxKind.Unknown:
      case ts.SyntaxKind.EndOfFileToken:
      case ts.SyntaxKind.SingleLineCommentTrivia:
      case ts.SyntaxKind.MultiLineCommentTrivia:
      case ts.SyntaxKind.NewLineTrivia:
      case ts.SyntaxKind.WhitespaceTrivia:
      case ts.SyntaxKind.ShebangTrivia:
      case ts.SyntaxKind.ConflictMarkerTrivia:
      case ts.SyntaxKind.NumericLiteral:
      case ts.SyntaxKind.BigIntLiteral:
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      case ts.SyntaxKind.TemplateHead:
      case ts.SyntaxKind.TemplateMiddle:
      case ts.SyntaxKind.TemplateTail:
      case ts.SyntaxKind.OpenBraceToken:
      case ts.SyntaxKind.CloseBraceToken:
      case ts.SyntaxKind.OpenParenToken:
      case ts.SyntaxKind.CloseParenToken:
      case ts.SyntaxKind.OpenBracketToken:
      case ts.SyntaxKind.CloseBracketToken:
      case ts.SyntaxKind.DotToken:
      case ts.SyntaxKind.DotDotDotToken:
      case ts.SyntaxKind.SemicolonToken:
      case ts.SyntaxKind.CommaToken:
      case ts.SyntaxKind.LessThanToken:
      case ts.SyntaxKind.LessThanSlashToken:
      case ts.SyntaxKind.GreaterThanToken:
      case ts.SyntaxKind.LessThanEqualsToken:
      case ts.SyntaxKind.GreaterThanEqualsToken:
      case ts.SyntaxKind.EqualsEqualsToken:
      case ts.SyntaxKind.ExclamationEqualsToken:
      case ts.SyntaxKind.EqualsEqualsEqualsToken:
      case ts.SyntaxKind.ExclamationEqualsEqualsToken:
      case ts.SyntaxKind.EqualsGreaterThanToken:
      case ts.SyntaxKind.PlusToken:
      case ts.SyntaxKind.MinusToken:
      case ts.SyntaxKind.AsteriskToken:
      case ts.SyntaxKind.AsteriskAsteriskToken:
      case ts.SyntaxKind.SlashToken:
      case ts.SyntaxKind.PercentToken:
      case ts.SyntaxKind.PlusPlusToken:
      case ts.SyntaxKind.MinusMinusToken:
      case ts.SyntaxKind.AmpersandToken:
      case ts.SyntaxKind.BarToken:
      case ts.SyntaxKind.CaretToken:
      case ts.SyntaxKind.ExclamationToken:
      case ts.SyntaxKind.TildeToken:
      case ts.SyntaxKind.AmpersandAmpersandToken:
      case ts.SyntaxKind.BarBarToken:
      case ts.SyntaxKind.QuestionToken:
      case ts.SyntaxKind.ColonToken:
      case ts.SyntaxKind.BacktickToken:
      case ts.SyntaxKind.EqualsToken:
      case ts.SyntaxKind.PlusEqualsToken:
      case ts.SyntaxKind.MinusEqualsToken:
      case ts.SyntaxKind.AsteriskEqualsToken:
      case ts.SyntaxKind.SlashEqualsToken:
      case ts.SyntaxKind.Identifier:
      case ts.SyntaxKind.BreakKeyword:
      case ts.SyntaxKind.CaseKeyword:
      case ts.SyntaxKind.ConstKeyword:
      case ts.SyntaxKind.ContinueKeyword:
      case ts.SyntaxKind.DoKeyword:
      case ts.SyntaxKind.ElseKeyword:
      case ts.SyntaxKind.FalseKeyword:
      case ts.SyntaxKind.ForKeyword:
      case ts.SyntaxKind.IfKeyword:
      case ts.SyntaxKind.SwitchKeyword:
      case ts.SyntaxKind.TrueKeyword:
      case ts.SyntaxKind.WhileKeyword:
      case ts.SyntaxKind.LetKeyword:
      case ts.SyntaxKind.BooleanKeyword:
      case ts.SyntaxKind.NumberKeyword:
      case ts.SyntaxKind.SetKeyword:
      case ts.SyntaxKind.StringKeyword:
      case ts.SyntaxKind.UndefinedKeyword:
      case ts.SyntaxKind.BigIntKeyword:
      case ts.SyntaxKind.OfKeyword:
      case ts.SyntaxKind.Parameter:
      case ts.SyntaxKind.ArrayLiteralExpression:
      case ts.SyntaxKind.ObjectLiteralExpression:
      case ts.SyntaxKind.PropertyAccessExpression:
      case ts.SyntaxKind.ElementAccessExpression:
      case ts.SyntaxKind.CallExpression:
      case ts.SyntaxKind.ParenthesizedExpression:
      case ts.SyntaxKind.ArrowFunction:
      case ts.SyntaxKind.PrefixUnaryExpression:
      case ts.SyntaxKind.PostfixUnaryExpression:
      case ts.SyntaxKind.BinaryExpression:
      case ts.SyntaxKind.ConditionalExpression:
      case ts.SyntaxKind.TemplateExpression:
      case ts.SyntaxKind.SpreadElement:
      case ts.SyntaxKind.TemplateSpan:
      case ts.SyntaxKind.Block:
      case ts.SyntaxKind.EmptyStatement:
      case ts.SyntaxKind.VariableStatement:
      case ts.SyntaxKind.ExpressionStatement:
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.ContinueStatement:
      case ts.SyntaxKind.BreakStatement:
      case ts.SyntaxKind.ReturnStatement:
      case ts.SyntaxKind.SwitchStatement:
      case ts.SyntaxKind.VariableDeclaration:
      case ts.SyntaxKind.CaseBlock:
      case ts.SyntaxKind.PropertyAssignment:
      case ts.SyntaxKind.ShorthandPropertyAssignment:
      case ts.SyntaxKind.SpreadAssignment:
      case ts.SyntaxKind.SourceFile:
      case ts.SyntaxKind.InputFiles:
      /**JS DOC?
           * 
          JSDocTypeExpression = 294,
          JSDocAllType = 295,
          JSDocUnknownType = 296,
          JSDocNullableType = 297,
          JSDocNonNullableType = 298,
          JSDocOptionalType = 299,
          JSDocFunctionType = 300,
          JSDocVariadicType = 301,
          JSDocNamepathType = 302,
          JSDocComment = 303,
          JSDocTypeLiteral = 304,
          JSDocSignature = 305,
          JSDocTag = 306,
          JSDocAugmentsTag = 307,
          JSDocImplementsTag = 308,
          JSDocAuthorTag = 309,
          JSDocClassTag = 310,
          JSDocPublicTag = 311,
          JSDocPrivateTag = 312,
          JSDocProtectedTag = 313,
          JSDocReadonlyTag = 314,
          JSDocCallbackTag = 315,
          JSDocEnumTag = 316,
          JSDocParameterTag = 317,
          JSDocReturnTag = 318,
          JSDocThisTag = 319,
          JSDocTypeTag = 320,
          JSDocTemplateTag = 321,
          JSDocTypedefTag = 322,
          JSDocPropertyTag = 323,
           * */

      case ts.SyntaxKind.FirstAssignment:
      case ts.SyntaxKind.LastAssignment:
      case ts.SyntaxKind.FirstCompoundAssignment:
      case ts.SyntaxKind.LastCompoundAssignment:
      case ts.SyntaxKind.FirstReservedWord:
      case ts.SyntaxKind.LastReservedWord:
      case ts.SyntaxKind.FirstKeyword:
      case ts.SyntaxKind.LastKeyword:
      case ts.SyntaxKind.FirstFutureReservedWord:
      case ts.SyntaxKind.LastFutureReservedWord:
      case ts.SyntaxKind.FirstPunctuation:
      case ts.SyntaxKind.LastPunctuation:
      case ts.SyntaxKind.FirstToken:
      case ts.SyntaxKind.LastToken:
      case ts.SyntaxKind.FirstTriviaToken:
      case ts.SyntaxKind.LastTriviaToken:
      case ts.SyntaxKind.FirstLiteralToken:
      case ts.SyntaxKind.LastLiteralToken:
      case ts.SyntaxKind.FirstTemplateToken:
      case ts.SyntaxKind.LastTemplateToken:
      case ts.SyntaxKind.FirstBinaryOperator:
      case ts.SyntaxKind.LastBinaryOperator:
      case ts.SyntaxKind.FirstStatement:
      case ts.SyntaxKind.LastStatement:
      case ts.SyntaxKind.FirstNode:
      case ts.SyntaxKind.FirstJSDocNode:
      case ts.SyntaxKind.LastJSDocNode:
      case ts.SyntaxKind.FirstJSDocTagNode:
      case ts.SyntaxKind.LastJSDocTagNode:
        break;
      case ts.SyntaxKind.VariableDeclarationList:
        if ((node.flags & ts.NodeFlags.Let) == 0 && (node.flags & ts.NodeFlags.Const) == 0) {
          //its a var
          reportError(node);
        }
        break;
      default:
        reportError(node);
        break;
    }
  };

  getHintForForbiddenConstruct = (node: ts.Node): string | undefined => {
    switch (node.kind) {
      case ts.SyntaxKind.VariableDeclarationList:
        if ((node.flags & ts.NodeFlags.Let) == 0 && (node.flags & ts.NodeFlags.Const) == 0) {
          //its a var
          return "Use let instead of var.";
        }
    }

    return undefined;
  };
}
