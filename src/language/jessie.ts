import { ScriptDiagnostic, ValidatorDiagnostic } from '../common/script';
import { ProtoError, SyntaxErrorCategory } from './error';

export type JessieSyntaxProtoError = ProtoError & {
  category: SyntaxErrorCategory.SCRIPT_SYNTAX;
};

export type ForbiddenConstructProtoError = ProtoError & {
  detail: string;
  category: SyntaxErrorCategory.SCRIPT_VALIDATION;
};

export function mapScriptDiagnostic(
  diag: ScriptDiagnostic
): JessieSyntaxProtoError {
  return {
    ...diag,
    category: SyntaxErrorCategory.SCRIPT_SYNTAX,
  };
}

export function mapValidatorDiagnostic(
  diag: ValidatorDiagnostic
): ForbiddenConstructProtoError {
  return {
    ...diag,
    category: SyntaxErrorCategory.SCRIPT_VALIDATION,
  };
}
