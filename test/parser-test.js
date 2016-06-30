'use strict';

const assert = require('assert');

const Parser = require('../').Parser;

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
      assert.deepEqual(p.parse('name   =  '),
                       [ { type: 'Variable', name: 'name', value: '' } ]);
    });

    it('should parse empty declaration with fancy name', () => {
      assert.deepEqual(p.parse('name.-_   =  '),
                       [ { type: 'Variable', name: 'name.-_', value: '' } ]);
    });

    it('should parse declaration with value', () => {
      assert.deepEqual(p.parse('name = value '),
                       [ { type: 'Variable', name: 'name', value: 'value' } ]);
    });

    it('should parse declaration with "$ "', () => {
      assert.deepEqual(p.parse('name = $ '),
                       [ { type: 'Variable', name: 'name', value: ' ' } ]);
    });

    it('should parse declaration with "$:"', () => {
      assert.deepEqual(p.parse('name = $:'),
                       [ { type: 'Variable', name: 'name', value: ':' } ]);
    });

    it('should parse declaration with "$$"', () => {
      assert.deepEqual(p.parse('name = $$'),
                       [ { type: 'Variable', name: 'name', value: '$' } ]);
    });

    it('should parse declaration with "$\\n"', () => {
      assert.deepEqual(p.parse('name = a$\nb'),
                       [ { type: 'Variable', name: 'name', value: 'ab' } ]);
    });

    it('should parse declaration with "$\\r\\n"', () => {
      assert.deepEqual(p.parse('name = a$\r\nb'),
                       [ { type: 'Variable', name: 'name', value: 'ab' } ]);
    });

    it('should parse declaration with "${abc}"', () => {
      assert.deepEqual(p.parse('name = a${abc}b'),
          [ { type: 'Variable', name: 'name', value: 'a${abc}b' } ]);
    });
  });

  describe('build', () => {
    it('should parse one-liner build', () => {
      assert.deepEqual(p.parse('build a: cc b'), [ {
        type: 'Build',
        outputs: [ 'a' ],
        inputs: [ 'b' ],
        rule: 'cc',
        deps: { implicit: [], orderOnly: [] },
        params: {}
      } ]);
    });

    it('should parse build with vars', () => {
      assert.deepEqual(p.parse('build a: cc b \n  x=1\n  y=2'), [ {
        type: 'Build',
        outputs: [ 'a' ],
        inputs: [ 'b' ],
        rule: 'cc',
        deps: { implicit: [], orderOnly: [] },
        params: { x: '1', y: '2' }
      } ]);
    });

    it('should parse multiple builds with vars', () => {
      assert.deepEqual(p.parse('build a: cc b \n  x=1\n  y=2\n' +
                               'build c: cc d\n  z=1'), [ {
        type: 'Build',
        outputs: [ 'a' ],
        inputs: [ 'b' ],
        rule: 'cc',
        deps: { implicit: [], orderOnly: [] },
        params: { x: '1', y: '2' }
      }, {
        type: 'Build',
        outputs: [ 'c' ],
        inputs: [ 'd' ],
        rule: 'cc',
        deps: { implicit: [], orderOnly: [] },
        params: { z: '1' }
      } ]);
    });

    it('should parse build with just implict deps', () => {
      assert.deepEqual(p.parse('build a: cc b | c'), [ {
        type: 'Build',
        outputs: [ 'a' ],
        inputs: [ 'b' ],
        rule: 'cc',
        deps: { implicit: [ 'c' ], orderOnly: [] },
        params: {}
      } ]);
    });

    it('should parse build with just orderOnly deps', () => {
      assert.deepEqual(p.parse('build a: cc b || c'), [ {
        type: 'Build',
        outputs: [ 'a' ],
        inputs: [ 'b' ],
        rule: 'cc',
        deps: { implicit: [], orderOnly: [ 'c' ] },
        params: {}
      } ]);
    });

    it('should parse build with both deps', () => {
      assert.deepEqual(p.parse('build a: cc b | c || d'), [ {
        type: 'Build',
        outputs: [ 'a' ],
        inputs: [ 'b' ],
        rule: 'cc',
        deps: { implicit: [ 'c' ], orderOnly: [ 'd' ] },
        params: {}
      } ]);
    });

    it('should not parse build with duplicate deps', () => {
      assert.throws(() => {
        p.parse('build a: cc b || c || d');
      }, /Duplicate deps separator/);
    });
  });
});
