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
  while (this.maybeToken('Newline') !== false) {
    // no-op
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
        `Expected ${valid} token, but found ${token.type} at ` +
        `${this.pos()}`);
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
  return val;
};

Parser.prototype.parseVar = function parseVar(name) {
  const token = this.token('Special', '=');
  const value = this.string(false);

  return { type: 'Variable', name: name, value: value };
};

Parser.prototype.parseBuild = function parseBuild() {
  const outs = [];
  for (;;) {
    const output = this.string(true);
    if (output.isEmpty())
      break;
    outs.push(output);
  }
  this.token('Special', ':');

  const rule = this.token('Identifier');

  const ins = [ this.string(true) ];
  for (;;) {
    const input = this.string(true);
    if (input.isEmpty())
      break;
    ins.push(input);
  }

  const sep = this.maybeToken('Special');
  let deps;
  if (sep)
    deps = this.parseDeps(sep.value);
  else
    deps = { implicit: [], orderOnly: [] };

  const params = this.maybeParams();
  if (!params)
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

Parser.prototype.maybeParams = function maybeParams() {
  if (this.maybeToken('Newline') === false)
    return false;

  const res = {};
  while (this.maybeToken('Indent') !== false) {
    const name = this.token([ 'Identifier', 'Keyword' ]);
    this.token('Special', '=');
    const value = this.string(false);

    res[name.value] = value;
  }
  return res;
};

Parser.prototype.consumeDeps = function consumeDeps(res) {
  for (;;) {
    const dep = this.string(true);
    if (dep.isEmpty())
      break;
    res.push(dep);
  }
};

Parser.prototype.parseDeps = function parseDeps(sep) {
  const res = { implicit: [], orderOnly: [] };

  const target = sep === '|' ? res.implicit : res.orderOnly;
  this.consumeDeps(target);

  const next = this.maybeToken('Special');

  const otherSep = sep === '|' ? '||' : '|';
  const other = sep === '|' ? res.orderOnly : res.implicit;

  if (next && next.value === otherSep)
    this.consumeDeps(other);
  else if (next)
    throw new Error(`Duplicate deps separator at ${this.pos()}`);

  return res;
};

Parser.prototype.parseRule = function parseRule() {
  const name = this.token('Identifier').value;
  const params = this.maybeParams();
  if (params === false)
    throw new Error(`Missing variables for rule "${name}" at ${this.pos()}`);

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
  this.token('Newline');

  return {
    type: 'Include',
    argument: path
  };
};

Parser.prototype.parsePool = function parsePool() {
  const name = this.token('Identifier').value;
  const params = this.maybeParams();
  if (params === false)
    throw new Error(`Missing variables for pool "${name}" at ${this.pos()}`);

  if (!params.hasOwnProperty('depth'))
    throw new Error(`Missing depth for pool "${name}" at ${this.pos()}`);

  if (Object.keys(params).length !== 1)
    throw new Error(`Unexpected variables for pool "${name}" at ${this.pos()}`);

  return {
    type: 'Pool',
    name: name,
    depth: params.depth
  };
};

Parser.prototype.parseDefault = function parseDefault() {
  const res = [ this.string(true) ];
  while (this.maybeToken('Newline') === false)
    res.push(this.string(true));

  return {
    type: 'Default',
    targets: res
  };
};
