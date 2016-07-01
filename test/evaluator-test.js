/* global describe it */
'use strict';

const assert = require('assert');

const ninja = require('../');
const Parser = ninja.Parser;
const Evaluator = ninja.Evaluator;

describe('ninja/Evaluator', () => {
  function parse(string) {
    const p = new Parser();
    return p.parse(string);
  }

  function run(string, options) {
    const ast = parse(string);
    const e = new Evaluator(options);
    return e.run(ast);
  }

  it('should evaluate variables in rule/pool/build', () => {
    assert.deepEqual(
      run('a=resolved\n' +
          'cc=clang\n' +
          'depth=4\n' +
          'pool a\n  depth=$depth\n' +
          'rule r\n  command=$cc $in -o $out\n  pool=a\n' +
              '  description=CC $out\n' +
          'build $a/f.out: r $a/f.in $b | $a/i || $a/o\n  b=i-am-$a!'),
      [ {
        type: 'Build',
        rule: {
          name: 'r',
          command: 'clang resolved/f.in i-am-resolved! -o resolved/f.out',
          params: {
            description: 'CC resolved/f.out',
            pool: {
              type: 'Pool',
              name: 'a',
              depth: '4'
            }
          }
        },
        deps: { implicit: [ 'resolved/i' ], orderOnly: [ 'resolved/o' ] },
        inputs: [ 'resolved/f.in', 'i-am-resolved!' ],
        outputs: [ 'resolved/f.out' ],
        params: { b: 'i-am-resolved!' }
      } ]
    );
  });

  it('should evaluate variables in included ninjas', () => {
    const load = (name) => {
      assert.equal(name, 'sub.ninja');
      return parse('cc=gcc\n' +
                   'cflags=-O3\n' +
                   'build sub.out: r sub.in\n  extra=\n');
    };

    const options = { load: load };

    assert.deepEqual(
      run('cc=clang\n' +
          'rule r\n  command=$cc $cflags $extra $in -o $out\n' +
          'subninja sub.ninja\n' +
          'build f.out: r f.in\n  extra=-Werror', options),
      [ {
        type: 'Build',
        rule: {
          name: 'r',
          command: 'gcc -O3  sub.in -o sub.out',
          params: {}
        },
        deps: { implicit: [], orderOnly: [] },
        inputs: [ 'sub.in' ],
        outputs: [ 'sub.out' ],
        params: { extra: '' }
      }, {
        type: 'Build',
        rule: {
          name: 'r',
          command: 'clang  -Werror f.in -o f.out',
          params: {}
        },
        deps: { implicit: [], orderOnly: [] },
        inputs: [ 'f.in' ],
        outputs: [ 'f.out' ],
        params: { extra: '-Werror' }
      } ]
    );
  });

  it('should evaluate `default`', () => {
    assert.deepEqual(run('a=1\ndefault $a.o\n'), [ {
      type: 'Default',
      targets: [ '1.o' ]
    } ]);
  });
});
