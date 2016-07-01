'use strict';
const async = require('async');

function Builder(options) {
  this.options = options || {};

  this.isWin = options.isWin;
  this.exec = this.options.exec;
  this.ensureDir = this.options.ensureDir;
  this.store = this.options.store;

  this.warning = this.options.warning || (() => {});
  this.jobs = this.options.jobs;

  this.defaultPool = new Pool(this.jobs);

  this.built = null;
  this.map = null;
  this.pools = null;
}
module.exports = Builder;

Builder.prototype.getDefaults = function getDefaults(ast) {
  let res = [];
  for (let i = 0; i < ast.length; i++) {
    const node = ast[i];
    if (node.type !== 'Default')
      continue;

    res = res.concat(node.targets);
  }
  return res;
};

function Pool(depth) {
  this.depth = depth;
  this.running = 0;
  this.queue = [];
}
Builder.Pool = Pool;

Pool.prototype.run = function run(body, callback) {
  if (this.running >= this.depth)
    return this.queue.push(() => this.run(body, callback));

  this.running++;
  body((err) => {
    callback(err);
    this.running--;
    const next = this.queue.shift();
    if (next)
      next();
  });
};

Builder.prototype.pool = function pool(p, body, callback) {
  this.defaultPool.run((callback) => {
    if (!this.pools.has(p))
      return body(callback);
    const pool = this.pools.get(p);
    pool.run(body, callback);
  }, callback);
};


Builder.prototype.build = function build(targets, ast, callback) {
  if (targets.length === 0)
    targets = this.getDefaults(ast);

  this.built = new Map();
  this.pools = new Map();
  this.map = new Map();

  // Default pool
  this.pools.set(undefined, new Pool(this.jobs));

  this.constructMap(ast);

  async.forEach(targets, (target, callback) => {
    if (!this.map.has(target))
      throw new Error(`Unknown target "${target}"`);

    return this.buildOne(target, callback);
  }, (err) => {
    this.built = null;
    this.map = null;
    callback(err);
  });
};

Builder.prototype.constructMap = function constructMap(ast) {
  for (let i = 0; i < ast.length; i++) {
    const node = ast[i];
    if (node.type !== 'Build')
      continue;

    const cmd = {
      command: node.rule.command,
      rule: node.rule.name,
      description: node.rule.params.description || node.rule.command,
      pool: node.rule.pool,

      // Windows-specific
      rspfile: node.rule.params.hasOwnProperty('rspfile') && {
        path: node.rule.params.rspfile,
        contents: node.rule.params.rspfile_content || ''
      },

      // For `ensureDir`
      outputs: node.outputs,

      // We don't really differentiate
      deps: node.deps.implicit.concat(node.deps.orderOnly, node.inputs)
    };

    node.outputs.forEach((out) => {
      if (this.map.has(out)) {
        this.warning(`Duplicate output file "${out}"`);
        return;
      }

      this.map.set(out, cmd);
    });
  }
};

Builder.prototype.buildOne = function buildOne(target, callback) {
  if (!this.map.has(target))
    return callback(null);

  if (this.built.has(target))
    return this.built.get(target)(callback);

  const queue = [];
  this.built.set(target, cb => queue.push(cb));

  const cmd = this.map.get(target);

  // TODO(indutny): throw on circular deps
  async.series([
    (callback) => {
      async.forEach(cmd.deps, (dep, callback) => {
        this.buildOne(dep, callback);
      }, callback);
    },
    (callback) => {
      if (cmd.rule === 'phony')
        return callback(null);

      async.forEach(cmd.outputs, (out, callback) => {
        this.ensureDir(out, callback);
      }, callback);
    },
    (callback) => {
      if (cmd.rule === 'phony' || !this.isWin || !cmd.rspfile)
        return callback(null);

      this.store(cmd.rspfile.path, cmd.rspfile.contents, callback);
    },
    (callback) => {
      if (cmd.rule === 'phony')
        return callback(null);

      this.pool(cmd.pool, (callback) => {
        this.exec(cmd.command, cmd.description, callback);
      }, callback);
    },
    (callback) => {
      // Let others know that we are done
      if (this.built)
        this.built.set(target, cb => cb(null));

      callback(null);

      // Process queue
      queue.forEach(item => item(null));
    }
  ], callback);
};
