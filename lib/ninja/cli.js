'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const exec = require('child_process').exec;
const argsParser = require('yargs-parser');

const ninja = require('../ninja');

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

  const b = new ninja.Builder({
    jobs: argv.j || os.cpus().length,
    exec: (cmd, desc, callback) => {
      console.log(desc);
      exec(cmd, {
        cwd: cwd,
        stdio: [ 'inherit', argv.v ? 'inherit' : 'null', 'inherit' ]
      }, callback);
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
