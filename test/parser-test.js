/* global describe it beforeEach afterEach */
'use strict';

const assert = require('assert');

const Parser = require('../').Parser;
const T = require('../').Lexer.Template;

describe('ninja/Parser', () => {
  let p;

  beforeEach(() => {
    p = new Parser();
  });
  afterEach(() => {
    p = null;
  });

  describe('var', () => {
    it('should not parse var after indent', () => {
      assert.throws(() => {
        p.parse(' name =\n');
      }, /but found Indent at 1:1/);
    });

    it('should parse empty declaration', () => {
      assert.deepEqual(p.parse('name   =  \n'), [
          { type: 'Variable', name: 'name', value: new T('') } ]);
    });

    it('should parse empty declaration with fancy name', () => {
      assert.deepEqual(p.parse('name.-_   =  \n'), [
          { type: 'Variable', name: 'name.-_', value: new T('') } ]);
    });

    it('should parse declaration with value', () => {
      assert.deepEqual(p.parse('name = value \n'), [
          { type: 'Variable', name: 'name', value: new T('value ') } ]);
    });
  });

  describe('build', () => {
    it('should parse one-liner build', () => {
      assert.deepEqual(p.parse('build a : cc b \n'), [ {
        type: 'Build',
        outputs: [ new T('a') ],
        inputs: [ new T('b') ],
        rule: 'cc',
        deps: { implicit: [], orderOnly: [] },
        params: {}
      } ]);
    });

    it('should parse build with vars', () => {
      assert.deepEqual(p.parse('build a: cc b \n  x=1\n  y=2\n'), [ {
        type: 'Build',
        outputs: [ new T('a') ],
        inputs: [ new T('b') ],
        rule: 'cc',
        deps: { implicit: [], orderOnly: [] },
        params: { x: new T('1'), y: new T('2') }
      } ]);
    });

    it('should parse multiple builds with vars', () => {
      assert.deepEqual(p.parse('build a: cc b \n  x=1\n  y=2\n' +
                               'build c: cc d\n  z=1\n'), [ {
                                 type: 'Build',
                                 outputs: [ new T('a') ],
                                 inputs: [ new T('b') ],
                                 rule: 'cc',
                                 deps: { implicit: [], orderOnly: [] },
                                 params: { x: new T('1'), y: new T('2') }
                               }, {
                                 type: 'Build',
                                 outputs: [ new T('c') ],
                                 inputs: [ new T('d') ],
                                 rule: 'cc',
                                 deps: { implicit: [], orderOnly: [] },
                                 params: { z: new T('1') }
                               } ]);
    });

    it('should parse build with just implicit deps', () => {
      assert.deepEqual(p.parse('build a: cc b | c\n'), [ {
        type: 'Build',
        outputs: [ new T('a') ],
        inputs: [ new T('b') ],
        rule: 'cc',
        deps: { implicit: [ new T('c') ], orderOnly: [] },
        params: {}
      } ]);
    });

    it('should parse build with just orderOnly deps', () => {
      assert.deepEqual(p.parse('build a: cc b || c\n'), [ {
        type: 'Build',
        outputs: [ new T('a') ],
        inputs: [ new T('b') ],
        rule: 'cc',
        deps: { implicit: [], orderOnly: [ new T('c') ] },
        params: {}
      } ]);
    });

    it('should parse build with both deps', () => {
      assert.deepEqual(p.parse('build a: cc b | c || d\n'), [ {
        type: 'Build',
        outputs: [ new T('a') ],
        inputs: [ new T('b') ],
        rule: 'cc',
        deps: { implicit: [ new T('c') ], orderOnly: [ new T('d') ] },
        params: {}
      } ]);
    });

    it('should not parse build with duplicate deps', () => {
      assert.throws(() => {
        p.parse('build a: cc b || c || d');
      }, /Duplicate deps separator/);
    });
  });

  describe('rule', () => {
    it('should parse minimal rule', () => {
      assert.deepEqual(p.parse('rule a\n command=a $in $out\n'), [ {
        type: 'Rule',
        name: 'a',
        command: new T([ 'a ', 'in', ' ', 'out', '' ]),
        params: {}
      } ]);
    });

    it('should fail to parse rule without command', () => {
      assert.throws(() => p.parse('rule a\n'), /command/);
    });
  });

  describe('subninja', () => {
    it('should parse subninja', () => {
      assert.deepEqual(p.parse('subninja /a/b/c\n'), [ {
        type: 'Include',
        argument: new T('/a/b/c')
      } ]);
    });

    it('should parse include', () => {
      assert.deepEqual(p.parse('include /a/b/c \n'), [ {
        type: 'Include',
        argument: new T('/a/b/c')
      } ]);
    });
  });

  describe('pool', () => {
    it('should parse pool', () => {
      assert.deepEqual(p.parse('pool a\n depth=123\n'), [ {
        type: 'Pool',
        name: 'a',
        depth: new T('123')
      } ]);
    });

    it('should fail to parse pool without depth', () => {
      assert.throws(() => p.parse('pool a\n'), /depth/);
    });

    it('should fail to parse pool with unknown vars', () => {
      assert.throws(() => p.parse('pool a\n depth=123\n x=2\n'), /variables/);
    });
  });

  describe('default', () => {
    it('should parse default', () => {
      assert.deepEqual(p.parse('default a b c \n'), [ {
        type: 'Default',
        targets: [ new T('a'), new T('b'), new T('c') ]
      } ]);
    });
  });
});
