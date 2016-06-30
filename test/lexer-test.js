'use strict';

const assert = require('assert');

const Lexer = require('../').Lexer;

describe('ninja/Lexer', () => {
  describe('.token()', () => {
    function token(str) {
      const l = new Lexer(str);
      return l.token();
    }

    it('should parse EOF', () => {
      assert.deepEqual(token(''), { type: 'EOF', value: null });
    });

    it('should ignore comments', () => {
      assert.deepEqual(token('#abc'), { type: 'EOF', value: null });
    });

    it('should parse keyword', () => {
      assert.deepEqual(token('build'), { type: 'Keyword', value: 'build' });
      assert.deepEqual(token('rule'), { type: 'Keyword', value: 'rule' });
      assert.deepEqual(token('default'), { type: 'Keyword', value: 'default' });
      assert.deepEqual(token('subninja'),
                       { type: 'Keyword', value: 'subninja' });
      assert.deepEqual(token('include'), { type: 'Keyword', value: 'include' });
      assert.deepEqual(token('pool'), { type: 'Keyword', value: 'pool' });
    });

    it('should parse identifier', () => {
      assert.deepEqual(token('my_.-Var'),
                       { type: 'Identifier', value: 'my_.-Var' });
    });

    it('should parse newline', () => {
      assert.deepEqual(token('\n'), { type: 'Newline', value: '\n' });
      assert.deepEqual(token('\r\n'), { type: 'Newline', value: '\r\n' });
    });

    it('should parse indent', () => {
      assert.deepEqual(token('  '), { type: 'Indent', value: '  ' });
      assert.deepEqual(token(' \t '), { type: 'Indent', value: ' \t ' });
      assert.deepEqual(token(' \n '), { type: 'Indent', value: ' ' });
    });

    it('should parse special', () => {
      assert.deepEqual(token('|'), { type: 'Special', value: '|' });
      assert.deepEqual(token('||'), { type: 'Special', value: '||' });
      assert.deepEqual(token(':'), { type: 'Special', value: ':' });
      assert.deepEqual(token('='), { type: 'Special', value: '=' });
    });

    it('should advance position', () => {
      const l = new Lexer('abc def ghi');
      assert.deepEqual(l.token(), { type: 'Identifier', value: 'abc' });
      assert.deepEqual(l.token(), { type: 'Indent', value: ' ' });
      assert.deepEqual(l.token(), { type: 'Identifier', value: 'def' });
      assert.deepEqual(l.token(), { type: 'Indent', value: ' ' });
      assert.deepEqual(l.token(), { type: 'Identifier', value: 'ghi' });
      assert.deepEqual(l.token(), { type: 'EOF', value: null });
    });

    it('should fail to parse garbage', () => {
      assert.throws(() => {
        token('<<abc 123');
      }, /Expected token at 1:1, but found "<<abc"/);
    });
  });

  describe('.peekToken()', () => {
    it('should not advance position', () => {
      const l = new Lexer('abc def ghi');
      assert.deepEqual(l.peekToken(), { type: 'Identifier', value: 'abc' });
      assert.deepEqual(l.peekToken(), { type: 'Identifier', value: 'abc' });
    });
  });

  describe('.string()', () => {
    function string(str) {
      const l = new Lexer(str);
      return l.string();
    }

    it('should parse regular string', () => {
      assert.equal(string('value '), 'value');
    });

    it('should parse string with "$ "', () => {
      assert.equal(string('$ '), ' ');
    });

    it('should parse string with "$:"', () => {
      assert.equal(string('$:'), ':');
    });

    it('should parse string with "$$"', () => {
      assert.equal(string('$$'), '$');
    });

    it('should parse string with "$\\n"', () => {
      assert.equal(string('a$\nb'), 'ab');
    });

    it('should parse string with "$\\r\\n"', () => {
      assert.equal(string('a$\r\nb'), 'ab');
    });

    it('should parse declaration with "${abc}"', () => {
      assert.equal(string('a${abc}b'), 'a${abc}b');
    });
  });
});
