/* global describe it */
'use strict';

const assert = require('assert');

const Lexer = require('../').Lexer;
const Template = Lexer.Template;

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
      assert.deepEqual(token('#abc\n#abc\n'), { type: 'EOF', value: null });
      assert.deepEqual(token('#\n#abc\n'), { type: 'EOF', value: null });
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
      assert.deepEqual(l.token(), { type: 'Identifier', value: 'def' });
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

    function path(str) {
      const l = new Lexer(str);
      return l.string(true);
    }

    it('should parse regular string', () => {
      assert.deepEqual(string('value '), new Template([ 'value ' ]));
      assert.deepEqual(path('value '), new Template([ 'value' ]));
    });

    it('should parse string with "$ "', () => {
      assert.deepEqual(string('$ '), new Template([ ' ' ]));
    });

    it('should parse string with "$:"', () => {
      assert.deepEqual(string('$:'), new Template([ ':' ]));
    });

    it('should parse string with "$$"', () => {
      assert.deepEqual(string('$$'), new Template([ '$' ]));
    });

    it('should parse string with "$\\n"', () => {
      assert.deepEqual(string('a$\nb'), new Template([ 'ab' ]));
    });

    it('should parse string with "$\\r\\n"', () => {
      assert.deepEqual(string('a$\r\nb'), new Template([ 'ab' ]));
    });

    it('should parse declaration with "${abc}"', () => {
      assert.deepEqual(string('a${abc}b'), new Template([ 'a', 'abc', 'b' ]));
    });

    it('should parse declaration with "$a"', () => {
      assert.deepEqual(string('a$a.b'), new Template([ 'a', 'a', '.b' ]));
    });
  });
});
