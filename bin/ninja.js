#!/usr/bin/env node
'use strict';

const ninja = require('../');

ninja.cli.run(process.argv, {
  log: (msg) => console.log(msg),
  warning: (msg) => console.error(msg)
}, (err) => {
  if (err)
    throw err;
});
