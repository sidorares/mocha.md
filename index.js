var fs = require('fs');

var marked  = require('marked');
var esprima = require('esprima');
var SourceMapGenerator = require('source-map').SourceMapGenerator;
var convert = require('convert-source-map');

//var text = fs.readFileSync('./atoms.md', 'utf-8');
//var text = fs.readFileSync('./simple.md', 'utf-8');


function TestSuite(name, level, parent) {
  this.name = name;
  this.code = '';
  this.suites = [];
  this.tests = [];
  this.level = level;
  this.parent = parent;
}

function TestCase(name) {
  this.name = name;
  this.code = '';
}


function mdcompile(text) {

  var tokens = marked.lexer(text);
  var renderer     = new marked.Renderer();
renderer.suite        = new TestSuite('', 0);
renderer.currentSuite = renderer.suite;

renderer.heading = function(text, level) {
  // create "describe" block.
  // check for "only" and "skip"
  // http://visionmedia.github.io/mocha/#exclusive-tests
  // http://visionmedia.github.io/mocha/#inclusive-tests

  // find parent to it
  //if last describe level == level
  //describe.parent = lastDeccribe.parent

  this.currentTest = null;
  var suite = new TestSuite(text);
  this.currentSuite.suites.push(suite);
  this.currentSuite = suite;
}

renderer.blockquote = function(q, raw) {
  //console.log(q, raw);
  //console.log('AAAAAAAAAAAAA');
}

renderer.code = function(code, language) {
  var lineNo = parseInt(language.split('-')[1]);
  if (this.currentTest) {
    this.currentTest.code += code;
    this.currentTest.codeLineNo = lineNo+1;
  } else {
    this.currentSuite.code += code;
    this.currentSuite.codeLineNo = lineNo+1;
  }
}

renderer.paragraph = function(text) {
  //console.log('PARA', arguments);
  var test = new TestCase(text);
  this.currentTest = test;
  this.currentSuite.tests.push(test);
}

function generate(s, map, offset) {
  var output = [];
  if (s.name !== '') {
    output.push('describe("' + s.name + '", function() {');
    offset++;
  }
  if (s.codeLineNo) {
    debugger
  map.addMapping({
      generated: {
        line: offset,
        column: 1
      },
      source: "test.md",
      original: {
        line: s.codeLineNo,
        column: 1
      },
  });
  }
  output.push(s.code);
  offset += s.code.split('\n').length;
  for (var i=0; i < s.suites.length; ++i) {
    var code = generate(s.suites[i], map, offset);
    offset += code.split('\n').length;
    output.push(code);
  }

  for (var i=0; i < s.tests.length; ++i) {
    output.push('  it("' + s.tests[i].name + '", function() {');
    offset++;
    //debugger;
    //map.addMapping({
    //  generated: {
    //    line: offset,
    //    column: 1
    //  },
    //  source: "test.md",
    //  original: {
    //    line: s.tests[i].codeLineNo,
    //    column: 1
    //  },
    //});
    offset += s.tests[i].code.split('\n').length + 1;
    output.push('    ' + s.tests[i].code);
    output.push('  });');
  }

  if (s.name !== '')
    output.push('})');

  return output.join('\n');
};

  // todo: initial pass to mark srtart / end of blockquote
  // todo: marked(tokens)
  marked(text, { renderer: renderer });
  var map = new SourceMapGenerator({
      file: "source-mapped.js"
  });
  var offset = 1;
  var code = generate(renderer.suite, map, offset);
  //console.log(map.toString());
  code += '\n' + convert.fromObject(map).toComment();
  return code;
}

function addLineNumbers(src) {
  var lines = src.split('\n');
  for (var i=0; i < lines.length; ++i) {
    if (lines[i] === '```js')
      lines[i] = '```js-' + i;
  }
  return lines.join('\n');
}

require.extensions['.md'] = function(module, filename) {
  var content;
  content = fs.readFileSync(filename, 'utf8');
  content = addLineNumbers(content);
  var test = mdcompile(content);
  //console.log(test);
  return module._compile(test, filename);
};

