'use strict';

function Lexer(str) {
  this.str = str;
  this.off = 0;
}
module.exports = Lexer;

const TOKEN = new RegExp('(?:#[^\\r\\n]*(?:\\n|\\r\\n|$))*(?:' +
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

  let res;
  if (match[1] !== undefined)
    res = { type: 'Identifier', value: match[1] };
  else if (match[2] !== undefined)
    res = { type: 'Newline', value: match[2] };
  else if (match[3] !== undefined)
    res = { type: 'Indent', value: match[3] };
  else if (match[4] !== undefined)
    res = { type: 'Special', value: match[4] };
  else
    res = { type: 'EOF', value: null };

  if (res.type !== 'EOF' && res.type !== 'Newline')
    this.whitespace();

  return res;
};

Lexer.prototype.peekToken = function peekToken() {
  const off = this.off;
  const token = this.token();
  this.off = off;
  return token;
};

const WS = /(?: |\$\r\n|\$\n)+/g;

Lexer.prototype.whitespace = function whitespace() {
  WS.lastIndex = this.off;
  const match = WS.exec(this.str);
  if (match === null)
    return false;

  if (match[0].length + this.off !== WS.lastIndex)
    return false;

  this.off += match[0].length;

  return true;
};

Lexer.prototype._checkEqual = function _checkEqual(actual, expected) {
  if (actual === expected)
    return;

  throw new Error(
      `Expected ${JSON.stringify(String.fromCharCode(expected))}, ` +
      `but found ${JSON.stringify(String.fromCharCode(actual))} at ` +
      `${this.pos()}`);
};

function Template(initial) {
  if (Array.isArray(initial))
    this.parts = initial;
  else if (typeof initial === 'string')
    this.parts = [ initial ];
  else
    this.parts = [ '' ];
}
Lexer.Template = Template;

Template.prototype.inspect = function inspect() {
  let res = this.parts[0];
  for (let i = 1; i < this.parts.length; i += 2)
    res += `$\{${this.parts[i]}\}${this.parts[i + 1]}`;
  return `<Template: ${res}>`;
};

Template.prototype.pushString = function pushString(str) {
  this.parts[this.parts.length - 1] += str;
};

Template.prototype.pushVar = function pushVar(name) {
  this.parts.push(name, '');
};

Template.prototype.isEmpty = function isEmpty() {
  return this.parts.length === 1 && this.parts[0].length === 0;
};

Template.prototype.render = function render(env) {
  let res = this.parts[0];
  for (let i = 1; i < this.parts.length; i += 2) {
    const name = this.parts[i];
    const next = this.parts[i + 1];

    res += env[name] || '';
    res += next;
  }
  return res;
};

const STRING = new RegExp('(?:' +
    '([^\\$ :\\r\\n|\\0]+)| ' +  // just text
    '(\r\n)|' +  // windows-style newline
    '([ :|\\n])|' +  // separators
    '(?:\\$(\\$| |:))|' +  // escapes
    '(\\$(?:\r\n *|\n *))|' +  // skipped escapes
    '(\\$(?:{[a-zA-Z0-9_.-]+}|[a-zA-Z0-9_-]+))|' +  // vars
    '(\\$\.)' +  // invalid escape
')', 'g');

// Inspired by original ninja implementation
Lexer.prototype.string = function string(path) {
  const res = new Template();

  for (;;) {
    const start = this.off;

    STRING.lastIndex = this.off;
    const match = STRING.exec(this.str);
    if (match === null)
      break;

    if (match[0].length + this.off !== STRING.lastIndex) {
      throw new Error(`Expected string at ${this.pos()}, but found ` +
                      `"${this.found()}"`);
    }
    this.off += match[0].length;

    if (match[1] !== undefined) {
      res.pushString(match[1]);
    } else if (match[2] !== undefined) {
      if (path)
        this.off = start;
      break;
    } else if (match[3] !== undefined) {
      if (path) {
        this.off = start;
        break;
      }

      if (match[3].charCodeAt(0) === 0x0a /* '\n' */)
        break;

      res.pushString(match[3]);
    } else if (match[4] !== undefined) {
      res.pushString(match[4]);
    } else if (match[5] !== undefined) {
      // Intentionally, skipped
    } else if (match[6] !== undefined) {
      res.pushVar(match[6].slice(1).replace(/^{(.*)}$/, '$1'), '');
    } else if (match[7] !== undefined) {
      throw new Error(`Invalid escape sequence at: ${this.pos()}`);
    }
  }

  if (path)
    this.whitespace();

  return res;
};
