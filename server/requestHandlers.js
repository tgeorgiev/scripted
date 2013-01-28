/*******************************************************************************
 * @license
 * Copyright (c) 2012 VMware, Inc. All Rights Reserved.
 * THIS FILE IS PROVIDED UNDER THE TERMS OF THE ECLIPSE PUBLIC LICENSE
 * ("AGREEMENT"). ANY USE, REPRODUCTION OR DISTRIBUTION OF THIS FILE
 * CONSTITUTES RECIPIENTS ACCEPTANCE OF THE AGREEMENT.
 * You can obtain a current copy of the Eclipse Public License from
 * http://www.opensource.org/licenses/eclipse-1.0.php
 *
 * Contributors:
 *     Andrew Eisenberg
 *     Andrew Clement
 *     Kris De Volder
 *     Christopher Johnson
 ******************************************************************************/
 
/*global console require exports process*/
var querystring = require("querystring");
var fs = require("./utils/fake-fs-proxy");
var formidable = require("formidable");
var url = require('url');
var templates = require('./templates/template-provider');
var nodeNatives = require('./jsdepend/node-natives');
var isNativeNodeModulePath = nodeNatives.isNativeNodeModulePath;
var nativeNodeModuleName = nodeNatives.nativeNodeModuleName;

// TODO handle binary files
/*
 * Retrieve a specified field, request format: http://localhost:7261/get?file=XXX
 * Possible outcomes:
 * 200 response with the file contents in the response
 * 500 response with 'File not found' in response text (enoent)
 * 500 response with 'Error: '+error_text in response text
 */


//This function checks if there are any non-UTF8 characters (character code == 65533, "unknown") in the file.  If there are, it's binary
function isBinary (buffer){
	var buffer_utf8 = buffer.toString('utf8', 0, 24);

	for (var i = 0; i < buffer_utf8.length; i++){
		var code = buffer_utf8.charCodeAt(i);
		if (code === 65533 || code <= 8){
			return true;
		}
	}
	return false;
}

function get(response, request) {
  var file = url.parse(request.url,true).query.file;
	console.log("Processing get request for "+file);
	if (isNativeNodeModulePath(file)) {
		var contents = nodeNatives.getCode(nativeNodeModuleName(file));

		if (contents) {
			response.writeHead(200, {
				"Content-Type": "text/plain",
				"Cache-Control": "no-store"
			});
			response.write(contents);
			response.end();
			return;
		}
	}

  fs.readFile(file, function(err,data){
    if(err) {
	    // Look into why windows returns -1 for errno when readFile called on a directory (e.g. 'scr .')
		if (err.errno === 28 /*EISDIR*/ || err.errno === -1 /*Windows returns this for readFile on dirs*/) {
			// is a directory
			response.writeHead(500, { "Content-Type": "text/plain"});
			response.write("File is a directory");
			response.end();
        } else if (err.errno === 34 /*ENOENT*/) {
			// File not found
			response.writeHead(500, { "Content-Type": "text/plain"});
			response.write("File not found");
			response.end();
		} else {
			response.writeHead(500, {"Content-Type": "text/plain"});
			response.write("Error: "+err);
			response.end();
		}
    } else {

	  var binary = isBinary(data);

	  if(binary){
		  console.log('Cannot open binary file');
		  response.writeHead(500, {"Content-Type": "text/plain"});
		  response.write("Cannot open binary file");
		  response.end();
	  } else {
		  response.writeHead(200, {
			"Content-Type": "text/plain",
			"Cache-Control": "no-store"
		});
		  response.write(data);
		  response.end();
	  }


    }
  });
}

///**
// * Similar to get() but for files that do not exist this will attempt to create any
// * missing directories on the path to the file. Let's see how it goes using this.
// */
//function get2(response, request) {
//  var file = url.parse(request.url,true).query.file;
////  console.log("Processing get2 request for "+file);
//  if (!file) {
//    // no file passed in
//    response.writeHead(500, {
//        "Content-Type": "text/plain"
//    });
//    response.write("No file name passed in");
//    response.end();
//    return;
//  }
//  
//  fs.readFile(file, function(err,data){
//    if(err) {
//    	// Look into why windows returns -1 for errno when readFile called on a directory (e.g. 'scr .')
////    	console.log("get2() err.errno is "+err.errno);
//		if (err.errno === 28 /*EISDIR*/ || err.errno === -1 /*Windows returns this for readFile on dirs*/) {
//			// is a directory
//			response.writeHead(500, { "Content-Type": "text/plain"});
//			response.write("File is a directory");
//			response.end();
//        } else if (err.errno === 34 /*ENOENT*/) {
//			// File not found
//			// Let's create the folders leading to it - the file itself will
//			// be created when the user saves.
//			var toBuild = [];
//			var lastSlash = file.lastIndexOf('/');
//			while (lastSlash!==-1) {
//			  var aDirectory = file.substring(0,lastSlash);
//			  var directoryExists = fs.existsSync(aDirectory);
//			  if (!directoryExists) {
//				toBuild.unshift(aDirectory);
//				lastSlash = aDirectory.lastIndexOf('/');
//			  } else {
//				lastSlash=-1;
//			  }
//			}
//			if (toBuild.length!==0) {
//				for (var i=0;i<toBuild.length;i++) {
//					console.log("Creating directory "+toBuild[i]);
//					var exc = fs.mkdirSync(toBuild[i]);
//					console.log("exc="+exc+" is null?"+(exc===null));
//				}
//			}
//			
//			response.writeHead(500, { "Content-Type": "text/plain"});
//			response.write("File not found");
//			response.end();
//		} else {
//			response.writeHead(500, {"Content-Type": "text/plain"});
//			response.write("Error: "+err);
//			response.end();
//		}
//    } else {
//
//	  var binary = isBinary(data);
//
//	  if(binary){
//		  console.log('cannot open binary file');
//		  response.writeHead(204, {"Content-Type": "text/plain"});
//		  response.write("cannot open binary file");
//		  response.end();
//	  } else {
//		  response.writeHead(200, {
//			"Content-Type": "text/plain",
//			"Cache-Control": "no-store"
//		});
//		  response.write(data);
//		  response.end();
//	  }
//
//
//    }
//  });
//}

function handleTemplates(response, request) {
	var params = url.parse(request.url,true).query;
	var scope = params.scope;
	var root = params.root;
	if (!scope) {
		response.writeHead(400, {'content-type': 'application/json'});
		response.write('{"error" : "no scope provided" }');
		response.end();
		return;
	}
	console.log('Client requested content assist templates. Looking for scope "' + scope + '"' + (root ? ' with root: ' + root : ''));
	templates.processTemplates(root).then(
		function(res) {
			try {
				response.writeHead(200, {'content-type': 'application/json'});
				response.write(
				res[scope] ?
					JSON.stringify(res[scope]) :
					'[]');
					
			} catch (e) {
				console.error("Error sending templates to client.");
				console.error(e.stack);
			}
			response.end();
			console.log('Client requested content assist templates complete');
		},
		function(err) {
			console.log("Templates received errback");
			response.writeHead(500, {'content-type': 'application/json'});
			response.write('{"error" : true, "val" : "' + err + '"}');
			response.end();
		}
	);
}



/*
 * Filesystem list operations, returns dojo.data.Item objects (as JSON).
 *
 * Structure of a return Item is, for a directory:
 * {
	name:filename,
	path:path,
	parentDir:containingDir,
	size:size,				// bytes - not currently always set correctly
	directory:true/false,
	Location:filename,
	children:[item],
	ChildrenLocation:pathForChildren
	modified:33				// not yet set correctly
   }
   
   children is an array of Item objects.  However, if directory is true and children isn't set, then ChildrenLocation is the
   path against which to run a further fs_list to obtain them.
   
   
 *
 */
function fs_list(response, request, path) {
	var pathToUse = null;
	if (path) {
		pathToUse = path;
	} else {
		var obj2;
		try {
			obj2 = url.parse(request.url,true).query;
			//console.log("fsq: request url query is "+url.parse(request.url,true).query);
			var data = JSON.parse(obj2.query);
			pathToUse = data.name;
		} catch (e) {
          response.writeHead(500, {'content-type': 'text/plain'});
          response.write('Invalid path request '+obj2);
          response.end();
		  return;
		}
	}
	//console.log("fs_list request for: "+pathToUse);
	
	/*
	This next line is due to the fact that /get and /fs_list are routed differently:
	<localhost> /get?file= <path>
	vs
	<localhost> /fs_list/ <path>
	*/
	pathToUse = pathToUse.replace(/%20/g, " ");

	fs.stat(pathToUse,function(err,stats) {
		if (err) { console.log(err); }
		//TODO platform specific...
		if (!stats || stats===undefined) {
          response.writeHead(404, {'content-type': 'text/plain'});
          response.write('not found '+pathToUse);
          response.end();
		  return;
		}
		var filename = pathToUse.split('/').pop();
		var directory = pathToUse.split('/').slice(-2,-1);
		var size =  stats.size;
		if (stats.isDirectory()) {
			fs.readdir(pathToUse,function(err,files) {
				if (err) { console.log(err); }
				var kids = [];
				for (var i=0;i<files.length;i++) {
					var kidpath = pathToUse+"/"+files[i];
				    try {
						var kidstat = fs.statSync(kidpath);
						var kid = {
							name:files[i],
							directory:kidstat.isDirectory(),
							Location:kidpath,
							size:0,
							parentDir:filename
						};
						if (kidstat.isDirectory()) {
							kid.ChildrenLocation = kidpath;
						}
						kids.push(kid);
					} catch (e) {
					  console.log("problems stat'ing "+kidpath);
					}
				}
    
				var retval = {
					name:filename,
					path:pathToUse,
					parentDir:directory,
					size:size,
					directory:true,
					Location:pathToUse,//filename,
					children:kids,
					modified:33};
				var respons = JSON.stringify(retval);
				// console.log("Response = "+respons);
				response.writeHead(200, {'content-type': 'application/json'});
				response.write(respons);
				response.end();
			});
		} else {
            // not a directory
			var retval = {items:[{
				name: filename,
				path:pathToUse,
				parentDir:directory,
				Location:pathToUse,
				size:size,
				directory:false,
				modified:33
				}]};
			var jsondata = JSON.stringify(retval);
			// console.log("Response = "+jsondata);
			response.writeHead(200, {'content-type': 'text/json'});
			response.write(jsondata);
			response.end();
		}
	});
}

// write a file
function put(response, request) {
  var file = url.parse(request.url,true).query.file;
  if (isNativeNodeModulePath(file)) {
	response.writeHead(500, {'content-type': 'text/plain'});
	response.write('Cannot save read only resource: '+file);
    response.end();
	return;
  }
  console.log(">> Processing put request for "+file);
  if (request.method.toLowerCase() === 'post') {
    // parse a file upload
    var form = new formidable.IncomingForm();
    form.parse(request, function(err, fields, files) {
      if (err) {
        console.log(err);
      }
      console.log("Text to be written is of length: "+fields.data.length);
      // i think the text encoding of the form submission params adds the CR
      // TODO need to respect the original formatting here, not arbitrarily delete CRs
//      var text = fields.text.replace(/\r/g,'');;
      // fields.text is the data to save
//      console.log("Text to be written is of length: "+text.length);
	  var dataToSave = fields.data;
      if (dataToSave.length != fields.length) { // DO NOT change to !== because fields.length is a string
        // return an error, it failed to save!
        response.writeHead(500, {'content-type': 'text/plain'});
        response.write('problem with save: received data length: '+dataToSave.length+' does not match transmitted length '+fields.length);
        response.end();
      }
      fs.writeFile(file,dataToSave,function(err) {
        if (err) {
          response.writeHead(500, {'content-type': 'text/plain'});
          response.write('problem with save:'+err);
          response.end();
        } else {
          response.writeHead(200, {'content-type': 'text/plain'});
          response.write('save successful\n');
          response.end();
        }
      });
    });
    return;
  }
}

exports.get = get;
exports.put = put;
exports.fs_list = fs_list;
exports.templates = handleTemplates;

