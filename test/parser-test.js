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
        p.parse(' name =');
      }, /Unexpected Indent at 1:1/);
    });

    it('should parse empty declaration', () => {
      assert.deepEqual(p.parse('name   =  '), [
          { type: 'Variable', name: 'name', value: new T('') } ]);
    });

    it('should parse empty declaration with fancy name', () => {
      assert.deepEqual(p.parse('name.-_   =  '), [
          { type: 'Variable', name: 'name.-_', value: new T('') } ]);
    });

    it('should parse declaration with value', () => {
      assert.deepEqual(p.parse('name = value '), [
          { type: 'Variable', name: 'name', value: new T('value ') } ]);
    });
  });

  describe('build', () => {
    it('should parse one-liner build', () => {
      assert.deepEqual(p.parse('build a : cc b '), [ {
        type: 'Build',
        outputs: [ new T('a') ],
        inputs: [ new T('b') ],
        rule: 'cc',
        deps: { implicit: [], orderOnly: [] },
        params: {}
      } ]);
    });

    it('should parse build with vars', () => {
      assert.deepEqual(p.parse('build a: cc b \n  x=1\n  y=2'), [ {
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
                               'build c: cc d\n  z=1'), [ {
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

    it('should parse build with just implict deps', () => {
      assert.deepEqual(p.parse('build a: cc b | c'), [ {
        type: 'Build',
        outputs: [ new T('a') ],
        inputs: [ new T('b') ],
        rule: 'cc',
        deps: { implicit: [ new T('c') ], orderOnly: [] },
        params: {}
      } ]);
    });

    it('should parse build with just orderOnly deps', () => {
      assert.deepEqual(p.parse('build a: cc b || c'), [ {
        type: 'Build',
        outputs: [ new T('a') ],
        inputs: [ new T('b') ],
        rule: 'cc',
        deps: { implicit: [], orderOnly: [ new T('c') ] },
        params: {}
      } ]);
    });

    it('should parse build with both deps', () => {
      assert.deepEqual(p.parse('build a: cc b | c || d'), [ {
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
      assert.deepEqual(p.parse('rule a\n command=a $in $out'), [ {
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
      assert.deepEqual(p.parse('subninja /a/b/c'), [ {
        type: 'Include',
        argument: new T('/a/b/c')
      } ]);
    });

    it('should parse include', () => {
      assert.deepEqual(p.parse('include /a/b/c '), [ {
        type: 'Include',
        argument: new T('/a/b/c')
      } ]);
    });
  });
});
