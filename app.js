// Run this with node to start your file tree server.
// Copyright © 2011-2014 Thaddee Tyl, Jan Keromnes. All rights reserved.
// The following code is covered by the AGPLv3 license.


// IMPORT MODULES
//

var Camp = require('camp');
var fs   = require('fs');
var app  = require('./lib/app');
var api  = require('./lib/api');
var configuration = require('./lib/conf');


// SERVER SETUP
//

// Start the server with command line options
var camp = Camp.start(configuration.http);

// Custom templating filter
function templateScript(text) {
  if (!text) { return 'undefined'; }
  return text.replace(/</g, '\\u003c');
}
function templatePath(text) {
  if (!text) { return ''; }
  return encodeURIComponent(text).replace(/%2F/g, unescape);
}
function templateLookup(params) {
  return [
    'if ($_scope.lookup && $_scope.file) {',
    '  $_scope.lookup(' + JSON.stringify(params[0]) + ', function(value, err) {',
    '    $_write(value);',
    '  });',
    '} else { $_write(""); }'
  ].join('\n');
}
Camp.templateReader.parsers.script = templateScript;
Camp.templateReader.parsers.path = templatePath;
Camp.templateReader.macros.lookup = templateLookup;

// Init subroutines
app.main(camp);
api.main(camp);


// ROUTING
//

// Let’s encrypt
camp.get('/.well-known/*', (req, res) => {
  fs.readFile('admin/.well-known/' + app.safePath(req.data[0]), (err, data) => {
    if (err) { res.statusCode = 404; res.end('Page not found\n'); return; }
    res.end(data);
  });
});
// Redirect all requests to a templated app.
camp.path('*', app.resolve);
camp.on('upgrade', app.websocket);
