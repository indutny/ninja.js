'use strict';

const util = require('util');

const ninja = require('../ninja');

function Parser() {
  this.lexer = null;
}
module.exports = Parser;

Parser.prototype.pos = function pos() {
  return this.lexer.pos();
};

Parser.prototype.parse = function parse(str) {
  this.lexer = new ninja.Lexer(str);
  const res = this.parseOne();
  if (!this.lexer.ended())
    throw new Error(`Unexpected data at ${this.lexer.pos()}`);
  this.lexer = null;
  return res;
};

Parser.prototype.space = function space() {
  let tolerateIndent = false;
  for (;;) {
    const token = this.maybeToken([ 'Indent', 'Newline' ]);
    if (token === false)
      break;

    if (token.type === 'Newline')
      tolerateIndent = true;
    else if (tolerateIndent)
      tolerateIndent = false;
    else
      throw new Error(`Unexpected Indent at ${this.pos()}`);
  }
};

Parser.prototype.token = function token(valid, value) {
  const token = this.lexer.token();
  if (valid === undefined)
    return token;

  let match;
  if (Array.isArray(valid))
    match = valid.indexOf(token.type) !== -1;
  else
    match = token.type === valid;
  if (value !== undefined)
    match = match && token.value === value;
  if (!match) {
    throw new Error(
        `Expected ${valid} token, but found ${token} at ${this.pos()}`);
  }
  return token;
};

Parser.prototype.maybeToken = function maybeToken(valid, value) {
  const token = this.lexer.peekToken();
  let match;
  if (Array.isArray(valid))
    match = valid.indexOf(token.type) !== -1;
  else
    match = token.type === valid;
  if (value !== undefined)
    match = match && token.value === value;
  if (!match)
    return false;

  return this.lexer.token();
};

Parser.prototype.parseOne = function parseOne() {
  const list = [];

  this.space();
  while (!this.lexer.ended()) {
    const word = this.token([ 'Identifier', 'Keyword' ]);
    this.token('Indent');

    let res;
    if (word.type === 'Identifier')
      res = this.parseVar(word.value);
    else if (word.value === 'build')
      res = this.parseBuild();
    else if (word.value === 'rule')
      res = this.parseRule();
    else if (word.value === 'pool')
      res = this.parsePool();
    else if (word.value === 'subninja' || word.value === 'include')
      res = this.parseInclude();
    else if (word.value === 'default')
      res = this.parseDefault();

    this.space();
    list.push(res);
  }

  return list;
};

Parser.prototype.string = function string(path) {
  const val = this.lexer.string(path);
  if (path)
    this.maybeToken('Indent');
  return val;
};

Parser.prototype.parseVar = function parseVar(name) {
  const token = this.token('Special', '=');
  this.maybeToken('Indent');

  const value = this.string(false);

  return { type: 'Variable', name: name, value: value };
};

Parser.prototype.parseBuild = function parseBuild() {
  const outs = [];
  do {
    outs.push(this.string(true));
    this.maybeToken('Indent');
    if (this.lexer.ended())
      throw new Error(`Unexpected EOF at ${this.pos()}`);
  } while (this.maybeToken('Special', ':') === false);

  this.maybeToken('Indent');
  const rule = this.token('Identifier');
  this.maybeToken('Indent');

  const ins = [];
  let sep;
  let hasParams;

  while (!this.lexer.ended()) {
    ins.push(this.string(true));
    this.maybeToken('Indent');
    if (this.lexer.ended())
      break;

    sep = this.maybeToken('Special');
    if (sep !== false)
      break;

    hasParams = this.maybeToken('Newline') !== false;
    if (hasParams)
      break;

    this.maybeToken('Indent');
  }

  // Deps
  let deps;
  if (sep && sep.type === 'Special')
    deps = this.parseDeps(sep.value);
  else
    deps = { implicit: [], orderOnly: [] };

  // Params
  let params;
  if (hasParams)
    params = this.parseParams();
  else
    params = {};

  return {
    type: 'Build',
    rule: rule.value,
    deps: deps,
    inputs: ins,
    outputs: outs,
    params: params
  };
};

Parser.prototype.parseParams = function parseParams() {
  const res = {};
  while (this.maybeToken('Indent') !== false) {
    const name = this.token('Identifier');
    this.maybeToken('Indent');
    this.token('Special', '=');
    this.maybeToken('Indent');
    const value = this.string(false);

    res[name.value] = value;
    if (this.maybeToken('EOF'))
      break;
  }
  return res;
};

Parser.prototype.consumeDeps = function consumeDeps(res) {
  for (;;) {
    if (this.lexer.ended())
      return false;

    const sep = this.maybeToken('Special');
    if (sep !== false)
      return sep.value;

    this.maybeToken('Indent');
    res.push(this.string(true));
    this.maybeToken('Indent');
  }
};

Parser.prototype.parseDeps = function parseDeps(sep) {
  const res = { implicit: [], orderOnly: [] };

  const target = sep === '|' ? res.implicit : res.orderOnly;
  const next = this.consumeDeps(target);

  const otherSep = sep === '|' ? '||' : '|';
  const other = sep === '|' ? res.orderOnly : res.implicit;
  if (!next)
    return res;

  if (next === otherSep) {
    if (this.consumeDeps(other))
      throw new Error(`Unexpected deps separator at ${this.pos()}`);
  } else {
    throw new Error(`Duplicate deps separator at ${this.pos()}`);
  }

  return res;
};

Parser.prototype.parseRule = function parseRule() {
  const name = this.token('Identifier').value;
  this.maybeToken('Indent');
  this.token('Newline');
  const params = this.parseParams();

  if (!params.hasOwnProperty('command'))
    throw new Error(`Missing command for rule "${name}" at ${this.pos()}`);

  // Slow, but meh...
  const command = params.command;
  delete params.command;

  return {
    type: 'Rule',
    name: name,
    command: command,
    params: params
  };
};

Parser.prototype.parseInclude = function parseInclude() {
  const path = this.string(true);

  return {
    type: 'Include',
    argument: path
  };
};
