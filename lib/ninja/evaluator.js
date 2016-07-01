'use strict';

const ninja = require('../ninja');
const Template = ninja.Lexer.Template;

const copy = ninja.utils.copy;
const extend = ninja.utils.extend;

function Evaluator(options, parent) {
  this.options = options || {};
  this.load = this.options.load;

  this.scope = parent ? copy(parent.scope) : {};
  this.rules = parent ? copy(parent.rules) : {};
  this.pools = parent ? copy(parent.pools) : {};

  if (!parent) {
    this.rules.phony = {
      name: 'phony', command: new Template('phony'), params: {}
    };
    this.pools.console = { name: 'console', depth: 1 };
  }
}
module.exports = Evaluator;

Evaluator.prototype.run = function run(ast) {
  const out = [];
  for (let i = 0; i < ast.length; i++)
    this.runOne(ast[i], out);
  return out;
};

Evaluator.prototype.resolve = function resolve(t, scope) {
  if (Array.isArray(t))
    return t.map(x => this.resolve(x, scope));
  else if (t instanceof Template)
    return t.render(scope || this.scope);
  else if (typeof t !== 'object')
    return t;

  const res = {};
  const keys = Object.keys(t);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    res[key] = this.resolve(t[key], scope);
  }
  return res;
};

Evaluator.prototype.runOne = function runOne(node, out) {
  let res;

  if (node.type === 'Variable')
    res = this.runVar(node);
  else if (node.type === 'Build')
    res = this.runBuild(node);
  else if (node.type === 'Rule')
    res = this.runRule(node);
  else if (node.type === 'Pool')
    res = this.runPool(node);
  else if (node.type === 'Default')
    res = this.runDefault(node);
  else if (node.type === 'Include')
    return this.runInclude(node, out);

  if (res !== undefined)
    out.push(res);
};

Evaluator.prototype.runVar = function runVar(node) {
  this.scope[node.name] = this.resolve(node.value);
};

Evaluator.prototype.genRule = function genRule(rule, params, inputs, outputs) {
  // TODO(indutny): line number? check it in parser?
  if (!this.rules.hasOwnProperty(rule))
    throw new Error(`Unknown rule: ${rule}`);

  // scope + params + inputs + outputs
  const subScope = extend(this.scope, params);
  subScope['in'] = inputs.join(' ');
  subScope['in_newline'] = inputs.join('\n');
  subScope['out'] = outputs.join(' ');

  const ruleParams = this.resolve(this.rules[rule].params, subScope);
  if (ruleParams.hasOwnProperty('pool')) {
    if (!this.pools.hasOwnProperty(ruleParams.pool))
      throw new Error(`Unknown pool ${ruleParams.pool}`);

    ruleParams.pool = this.pools[ruleParams.pool];
  }

  return {
    name: rule,
    command: this.resolve(this.rules[rule].command, subScope),
    params: ruleParams
  };
};

Evaluator.prototype.runBuild = function runBuild(node) {
  const params = this.resolve(node.params);
  const subScope = extend(this.scope, params);

  const inputs = this.resolve(node.inputs, subScope);
  const outputs = this.resolve(node.outputs, subScope);

  const rule = this.genRule(node.rule, params, inputs, outputs);

  return {
    type: 'Build',
    rule: rule,
    deps: {
      implicit: this.resolve(node.deps.implicit, subScope),
      orderOnly: this.resolve(node.deps.orderOnly, subScope)
    },
    inputs: inputs,
    outputs: outputs,
    params: params
  };
};

Evaluator.prototype.runRule = function runRule(node) {
  // TODO(indutny): line number? check it in parser?
  if (this.rules.hasOwnProperty(node.name))
    throw new Error(`Duplicate rule ${node.name}`);
  this.rules[node.name] = node;
};

Evaluator.prototype.runPool = function runPool(node) {
  // TODO(indutny): line number? check it in parser?
  if (this.pools.hasOwnProperty(node.name))
    throw new Error(`Duplicate pool ${node.name}`);

  // TODO(indutny): lazy resolve?
  this.pools[node.name] = {
    type: 'Pool',
    name: node.name,
    depth: this.resolve(node.depth)
  };
};

Evaluator.prototype.runDefault = function runDefault(node) {
  return {
    type: 'Default',
    targets: this.resolve(node.targets)
  };
};

Evaluator.prototype.runInclude = function runInclude(node, out) {
  const sub = new Evaluator(this.options, this);
  const path = this.resolve(node.argument);
  let subOut;
  try {
    subOut = sub.run(this.load(path));
  } catch (e) {
    e.message += `\nwhile evaluating "${path}"`;
    throw e;
  }
  for (let i = 0; i < subOut.length; i++)
    out.push(subOut[i]);
};
