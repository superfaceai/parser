import { DocumentedNode } from '@superfaceai/ast';

type TokenType = string | number | boolean;

export abstract class UnparserBase {
  protected currentDepth: number;
  protected readonly options: { indent: string };

  constructor(options?: { indent: string }) {
    this.currentDepth = 0;
    this.options = {
      indent: '  ',
      ...options,
    };
  }

  protected static wrapValidToken(token: TokenType | undefined, wrap: string): string | undefined {
    if (token === undefined) {
      return undefined;
    }

    return `${wrap}${token.toString()}${wrap}`;
  }

  protected static joinValidTokens(...tokens: (TokenType | undefined)[]): string {
    const toks = [];
    for (const token of tokens) {
      if (token === undefined) {
        continue;
      }

      const tok = token.toString();
      if (tok.length === 0) {
        continue;
      }

      toks.push(tok);
    }
    
    return toks.join(' ');
  }

  protected indentJoinLines(...strings: (string | undefined)[]): string {
    let result = '';

    for (const str of strings) {
      if (str !== undefined) {
        result +=
          this.options.indent.repeat(this.currentDepth) + str.trimStart() + '\n';
      }
    }

    return result;
  }

  protected stripLast(str: string): string {
    return str.slice(0, str.length - 1);
  }

  protected visitDocumentedNode(node: DocumentedNode): string | undefined {
    let doc = node.documentation?.title;
    if (node.documentation?.description !== undefined) {
      doc = (doc ?? '') + '\n\n' + node.documentation?.description;
    }

    if (doc !== undefined) {
      doc = `"""\n${doc}\n"""`;
      doc = this.indentJoinLines(...doc.split('\n'));
    }

    return doc;
  }
}
