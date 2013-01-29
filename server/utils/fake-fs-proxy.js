var Fs = require('fake-fs'), path = require('path');

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

function cloneFs(realFs, fakeFs, rootDir) {
  var fakePath = function(curDir) {
    return curDir.replace(rootDir, "");
  }

  var cloneFsInner = function(curDir) {
    realFs.readdir(curDir, function(err, files) {  
      if (err) throw err;

      var curDirFake = fakePath(curDir);
      if (!fakeFs.existsSync(curDirFake)) {
        fakeFs.mkdirSync(curDirFake);
      }

      if (!files.length) {
        return;
      }

      files.forEach(function(fileName) {
        var filePath = curDir + "/" + fileName;
        realFs.stat(filePath, function(err, stat) {
          if (err) throw err;
          
          if (stat) {
            if (stat.isFile()) {
              var content = realFs.readFileSync(filePath);

              var filePathFake = fakePath(filePath);
              fakeFs.writeFileSync(filePathFake, content);
            }
            else if (stat.isDirectory()) {
              cloneFsInner(filePath);
            } 
          }
        });
      });
    });
  }

  cloneFsInner(rootDir);
}

function FsProxy () {
  this.fs = new Fs(true);

  var realFs = require('fs');
  var rootToCopy = path.join(__dirname, '../../play-area/fake-fs');

  cloneFs(realFs, this.fs, rootToCopy);
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