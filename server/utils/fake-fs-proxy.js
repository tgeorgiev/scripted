var Fs = require('fake-fs')

function isString(value) {
  return Object.prototype.toString.call(value) == '[object String]'
}

function scriptedDoubleSlashFix (p) {
  if (p.indexOf("//") == 0) {
    p = p.replace("//", "/");
  }

  return p;
}

function fixArguments(funcArguments) {
  if (funcArguments) {
    for (var i = 0; i < funcArguments.length; i++) {
      var arg = funcArguments[i];
      if (isString(arg)) {
        funcArguments[i] = scriptedDoubleSlashFix(arg);
      }
    }
  }
}

function FsProxy () {
  this.fs = new Fs(true);

  this.fs.dir("a/b/c/d");
  this.fs.dir("a/e/f");
  this.fs.file("a/file1.txt");
  this.fs.file("g/file2.js");
}

var methods = [
    'exists',
    'stat',
    'readdir',
    'mkdir',
    'readFile',
    'writeFile',
    'rmdir',
    'unlink',
    'rename'
].reduce(function (res, meth) {
    res.push(meth)
    res.push(meth + 'Sync')
    return res
}, []);

//Scripted is passing paths starting with "//", this fixes it
methods.forEach(function (meth) {
  FsProxy.prototype[meth] = function () {
    fixArguments(arguments);
    return this.fs[meth].apply(this.fs, arguments);
  };
});

module.exports = new FsProxy();