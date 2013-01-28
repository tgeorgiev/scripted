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
 *     Scott Andrews
 ******************************************************************************/

var express = require('express');
var pathResolve = require('path').resolve;

function start(route, handle) {
	function onRequest(req, res, next) {
		var path = req.path;
		// Don't bother for favicon.ico
		if (path === '/favicon.ico') {
            res.writeHead(404, {
                "Content-Type": "text/html"
            });
            res.write("404 Not found");
            res.end();
			return;
		}
		//console.log("Request for " + path + " received.");
		route(handle, path, res, req, next);
	}

	var app = express.createServer();

	app.configure(function() {
		app.use(app.router);
		app.use(onRequest); // bridge to 'servlets', we should remove over time
		app.use(express['static'](pathResolve(__dirname, '../client')), { maxAge: 6e5 });
		app.use(express.errorHandler({
			dumpExceptions: true,
			showStack: true
		}));
	});

	require('./routes/fileRoutes').install(app);
	
	require('./servlets/incremental-search-servlet').install(app);
	require('./servlets/incremental-file-search-servlet').install(app);

	app.listen(7261);
	console.log("Server has started.");
}

exports.start = start;
