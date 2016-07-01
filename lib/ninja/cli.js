'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const exec = require('child_process').exec;

const argsParser = require('yargs-parser');
const mkdirp = require('mkdirp');

const ninja = require('../ninja');

// TODO(indutny): escaped env file
const WIN_ENV = /^\s*ninja\s+-t\s+msvc\s+(?:-e\s+([^\s]+?))?\s*--(.*)$/;

function prepareWinEnv(cmd, options, cwd, currentEnv, cache) {
  const match = cmd.match(WIN_ENV);
  if (match === null)
    return cmd;

  // No `-e`
  if (match[1] === undefined)
    return match[2];

  if (!cache.has(match[1])) {
    const lines = fs.readFileSync(path.join(cwd, match[1]))
        .toString().split(/\0/g);

    const env = {};
    Object.keys(currentEnv).forEach((key) => {
      env[key.toUpperCase()] = currentEnv[key];
    });

    lines.forEach((line) => {
      if (!line)
        return;
      const match = line.split(/=/);
      env[match[0]] = match[1];
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
    isWin: process.platform === 'win32',

    jobs: argv.j || os.cpus().length,
    exec: (cmd, desc, callback) => {
      const options = {
        cwd: cwd
      };

      // ninja -t msvc env --
      if (process.platform === 'win32')
        cmd = prepareWinEnv(cmd, options, cwd, process.env, envCache);

      console.log(argv.v ? cmd : desc);

      exec(cmd, options, (err, stdout, stderr) => {
        if (err) {
          if (argv.v) {
            console.error('----- STDOUT -----\n' + stdout);
            console.error('----- STDERR -----\n' + stderr);
          }
        }
        return callback(err);
      });
    },
    ensureDir: (file, callback) => {
      mkdirp(path.join(cwd, path.dirname(file)), callback);
    },
    store: (file, contents, callback) => {
      const fullPath = path.join(cwd, file);
      mkdirp(path.dirname(fullPath), (err) => {
        if (err)
          return callback(err);
        fs.writeFile(fullPath, contents, callback);
      });
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
