'use strict';

const assert = require('assert');
const path = require('path');

const ninja = require('../');
const cli = ninja.cli;

const file = path.join(__dirname, 'fixtures', 'win.env');

describe('ninja/CLI', () => {
  describe('.prepareWinEnv()', () => {
    it('should not change non-prefixed cmd', () => {
      const options = {};
      const cmd = cli.prepareWinEnv('abc', options, {}, new Map());
      assert.equal(cmd, 'abc');
      assert.deepEqual(options, {});
    });

    it('should change prefixed cmd', () => {
      const options = {};
      const cache = new Map();
      const cmd = cli.prepareWinEnv(`ninja -t msvc ${file} -- abc`, options,
                                    {}, cache);
      assert.equal(cmd, ' abc');
      assert.deepEqual(options, { env: { ABC: 123, DEF: 456 } });
      assert.deepEqual(cache.get(file), {  ABC: 123, DEF: 456 });
    });
  });
});
