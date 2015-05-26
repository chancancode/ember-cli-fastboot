var chalk = require('chalk');
var fs = require('fs');
var debug   = require('debug')('ember-cli-fastboot:server');

function FastBootServer(options) {
  this.app = options.app;

  this.html = fs.readFileSync(options.htmlFile, 'utf8');

  this.ui = options.ui;
}

FastBootServer.prototype.log = function(statusCode, message) {
  var color = statusCode === 200 ? 'green' : 'red';

  this.ui.writeLine(chalk[color](statusCode) + " " + message);
};

FastBootServer.prototype.insertIntoIndexHTML = function(title, body) {
  var html = this.html.replace("<!-- EMBER_CLI_FASTBOOT_BODY -->", body);

  if (title) {
    html = html.replace("<!-- EMBER_CLI_FASTBOOT_TITLE -->", "<title>" + title + "</title>");
  }

  return html;
};

FastBootServer.prototype.handleSuccess = function(res, path, result) {
  this.log(200, 'OK ' + path);
  res.send(this.insertIntoIndexHTML(result.title, result.body));
};

FastBootServer.prototype.handleFailure = function(res, path, error) {
  if (error.name === "UnrecognizedURLError") {
    this.log(404, "Not Found " + path);
    res.sendStatus(404);
  } else {
    console.log(error.stack);
    this.log(500, "Unknown Error: " + error);
    res.sendStatus(500);
  }
};

FastBootServer.prototype.middleware = function() {
  return function(req, res, next) {
    var path = req.path;
    debug("middleware request; path=%s", path);

    var server = this;

    function success(result) {
      server.handleSuccess(res, path, result);
    }

    function failure(error) {
      server.handleFailure(res, path, error);
    }

    debug("handling url; url=%s", path);

    this.app.handleURL(path).then(
      success, failure
    ).finally(function() {
      debug("finished handling; url=%s", path);
    });
  }.bind(this);
};

module.exports = FastBootServer;
