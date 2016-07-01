'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const exec = require('child_process').exec;

const argsParser = require('yargs-parser');
const mkdirp = require('mkdirp');

const ninja = require('../ninja');

// TODO(indutny): escaped env file
const WIN_ENV = /^\s*ninja\s+-t\s+msvc\s+([^\s]+?)\s*--(.*)$/;
const WIN_ENV_LINE = /^(\w+)=(\w+)$/;

function prepareWinEnv(cmd, options, currentEnv, cache) {
  const match = cmd.match(WIN_ENV);
  if (match === null)
    return cmd;

  if (!cache.has(match[1])) {
    const lines = fs.readFileSync(match[1]).toString().split(/\0/g);

    const env = ninja.utils.copy(currentEnv);
    lines.forEach((line) => {
      const match = line.match(WIN_ENV_LINE);
      if (match === null)
        return;

      env[match[1]] = match[2];
    });
    cache.set(match[1], env);
  }
  options.env = cache.get(match[1]);

  return match[2];
}
exports.prepareWinEnv = prepareWinEnv;

exports.run = function run(args) {
  const argv = argsParser(args);

  const parser = new ninja.Parser();

  const cwd = argv.C || '.';

  function load(file) {
    const contents = fs.readFileSync(path.join(cwd, file));
    try {
      return parser.parse(contents.toString());
    } catch (e) {
      e.message += `\nwhile loading "${file}"`;
      throw e;
    }
  }

  const main = load('build.ninja');

  let intermediate;
  try {
    const e = new ninja.Evaluator({ load: load });
    intermediate = e.run(main);
  } catch (e) {
    e.message += `\nWhile evaluating "build.ninja"`;
    throw e;
  }

  // Cache for Windows
  const envCache = new Map();

  const b = new ninja.Builder({
    jobs: argv.j || os.cpus().length,
    exec: (cmd, desc, callback) => {
      console.log(desc);

      const options = {
        cwd: cwd,
        stdio: [ 'inherit', argv.v ? 'inherit' : 'null', 'inherit' ]
      };

      // ninja -t msvc env --
      if (process.platform === 'win32')
        cmd = prepareWinEnv(cmd, options, process.env, envCache);

      exec(cmd, options, callback);
    },
    ensureDir: (file, callback) => {
      mkdirp(path.join(cwd, path.dirname(file)), callback);
    },

    warning: (msg) => {
      console.error(msg);
    }
  });

  b.build(argv._.slice(2), intermediate, (err) => {
    if (err)
      throw err;
    console.log('... done ...');
  });
};
