// Read configuration data.
var fs = require('fs');

try {
  var conf = require('../admin/private/' + process.env.ENV + '.json');
} catch(e) {
  var conf = {};
}

try {
  conf.pg.ssl.ca = fs.readFileSync(conf.pg.ssl.ca).toString();
  conf.pg.ssl.key = fs.readFileSync(conf.pg.ssl.key).toString();
  conf.pg.ssl.cert = fs.readFileSync(conf.pg.ssl.cert).toString();
} catch(e) {
  conf.pg.ssl = false;
}

module.exports = conf;