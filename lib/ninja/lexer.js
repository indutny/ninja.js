'use strict';

function Lexer(str) {
  this.str = str;
  this.off = 0;
}
module.exports = Lexer;

const TOKEN = new RegExp('(?:#[^\\r\\n]+(?:\\n|\\r\\n|$))?(?:' +
    '(build|rule|default|subninja|include|pool)|' +  // keyword
    '([a-zA-Z0-9_.-]+)|' +  // identifier
    '(\\n|\\r\\n)|' +  // newline
    '([ \\t]+)|' +  // indent
    '(\\|\\||[:|=])|' +  // special
    '$' +  // eof
')', 'g');

Lexer.prototype.pos = function pos() {
  const lines = this.str.split(/(\r\n|\r|\n)/g);
  let lineNum = 1;
  let columnNum = 0;
  let off = 0;
  lines.every((line, i) => {
    const nextOff = off + line.length;
    if (nextOff <= this.off) {
      off = nextOff;
      return true;
    }

    lineNum = (i >>> 1) + 1;
    columnNum = Math.max(1, this.off - off);
    return false;
  });

  return `${lineNum}:${columnNum}`;
};

Lexer.prototype.found = function found(str) {
  return this.str.slice(this.off).replace(/([^\s]+)\s.*$/, '$1').slice(0, 16);
};

Lexer.prototype.ended = function ended() {
  return this.off === this.str.length;
};

Lexer.prototype.token = function token() {
  TOKEN.lastIndex = this.off;
  const match = TOKEN.exec(this.str);

  if (match === null || match[0].length + this.off !== TOKEN.lastIndex) {
    throw new Error(`Expected token at ${this.pos()}, but found ` + 
                    `"${this.found()}"`);
  }

  this.off += match[0].length;

  if (match[1] !== undefined)
    return { type: 'Keyword', value: match[1] };
  else if (match[2] !== undefined)
    return { type: 'Identifier', value: match[2] };
  else if (match[3] !== undefined)
    return { type: 'Newline', value: match[3] };
  else if (match[4] !== undefined)
    return { type: 'Indent', value: match[4] };
  else if (match[5] !== undefined)
    return { type: 'Special', value: match[5] };
  else
    return { type: 'EOF', value: null };
};

Lexer.prototype.peekToken = function peekToken() {
  const off = this.off;
  const token = this.token();
  this.off = off;
  return token;
};

Lexer.prototype._checkEqual = function _checkEqual(actual, expected) {
  if (actual === expected)
    return;

  throw new Error(
      `Expected ${JSON.stringify(String.fromCharCode(expected))}, ` +
      `but found ${JSON.stringify(String.fromCharCode(actual))} at ` +
      `${this.pos()}`);
};

Lexer.prototype.string = function string() {
  let res = '';
  const str = this.str;
  while (this.off !== str.length) {
    const c = str.charCodeAt(this.off);

    if (c === 0x0d /* '\r' */ ||
        c === 0x0a /* '\n' */ ||
        c === 0x3a /* ':' */ ||
        c === 0x20 /* ' ' */ ||
        c === 0x7c /* '|' */) {
      if (res.length === 0) {
        throw new Error(
            `Expected string, but found ${this.found()} at ${this.pos}`);
      }
      break;
    }

    this.off++;

    if (c === 0x24 /* '$' */) {
      const n = str.charCodeAt(this.off++);
      if (n === 0x24 /* '$' */) {
        res += '$';
      } else if (n === 0x0a /* '\n' */) {
        // no-op
      } else if (n === 0x0d /* '\r' */) {
        // Windows
        this._checkEqual(str.charCodeAt(this.off++), 0x0a /* '\n' */);
      } else if (n === 0x20 /* ' ' */) {
        res += ' ';
      } else if (n === 0x3a /* ':' */) {
        res += ':';
      } else if (n === 0x7b /* '{' */) {
        const name = this.token();
        this._checkEqual(name.type, 'Identifier');
        this._checkEqual(str.charCodeAt(this.off++), 0x7d /* '}' */);
        res += '${' + name.value + '}';
      } else {
        throw new Error(
            `Unexpected char "${String.fromCharCode(n)}" at ${this.pos()}`);
      }
    } else {
      res += String.fromCharCode(c);
    }
  }
  return res;
};
