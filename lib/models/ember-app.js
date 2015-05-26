var fs = require('fs');

var Contextify = require('contextify');
var SimpleDOM = require('simple-dom');
var RSVP    = require('rsvp');
var chalk = require('chalk');
var najax = require('najax');
var debug   = require('debug')('ember-cli-fastboot:ember-app');
var emberDebug = require('debug')('ember-cli-fastboot:ember');

function formatError(error) {
  if (error.name && error.name !== "Error") {
    return error.message + " (" + error.name + ")";
  } else if (error.message) {
    return error.message;
  } else {
    return String(error);
  }
}

function boot(options) {
  debug("booting app from fiels; app=%s; vendor=%s", options.appFile, options.vendorFile);

  // Promise that represents the completion of app boot.
  var appBoot = RSVP.defer();

  // The contents of the compiled app/vendor JS bundles.
  var appFile, vendorFile;

  try {
    appFile = fs.readFileSync(options.appFile, 'utf8');
  } catch(error) {
    debug(chalk.red("unable to read app bundle from %s: %s"), options.appFile, formatError(error));
    debug(chalk.red("app boot failed"));
    return RSVP.reject(error);
  }

  try {
    vendorFile = fs.readFileSync(options.vendorFile, 'utf8');
  } catch(error) {
    debug(chalk.red("unable to read vendor bundle from %s: %s"), options.vendorFile, formatError(error));
    debug(chalk.red("app boot failed"));
    return RSVP.reject(error);
  }

  // Create the sandbox, giving it the resolver to resolve once the app
  // has booted.
  var sandbox = createSandbox(appBoot.resolve, {
    najax: najax
  });

  try {
    sandbox.run(vendorFile);
  } catch(error) {
    debug(chalk.red("error while evaluating vendor bundle: %s"), formatError(error));
    debug(chalk.red("app boot failed"));
    return RSVP.reject(error);
  }
  debug("vendor bundle evaluated");

  try {
    sandbox.run(appFile);
  } catch(error) {
    debug(chalk.red("error while evaluating app bundle: %s"), formatError(error));
    debug(chalk.red("app boot failed"));
    return RSVP.reject(error);
  }
  debug("app bundle evaluated");

  return appBoot.promise.then(
    function(handleURL) {
      debug("app booted");
      return new EmberApp(handleURL);
    },
    function(error) {
      debug(chalk.red("error while booting app: %s"), formatError(error));
      debug(chalk.red("app boot failed"));
      throw error;
    }
  );
}

function EmberApp(handleURL) {
  this.handleURL = handleURL;
}

function createSandbox(appBootResolver, dependencies) {
  var wrappedConsole =  Object.create(console);
  wrappedConsole.error = function() {
    console.error.apply(console, Array.prototype.map.call(arguments, function(a) {
      return typeof a === 'string' ? chalk.red(a) : a;
    }));
  };

  var sandbox = {
    // Expose this so that the FastBoot initializer has access to the fake DOM.
    // We don't expose this as `document` so that other libraries don't mistakenly
    // think they have a full DOM.
    SimpleDOM: SimpleDOM,

    // Expose the console to the FastBoot environment so we can debug
    console: wrappedConsole,

    // setTimeout is an assumed part of JavaScript environments. Expose it.
    setTimeout: setTimeout,

    // Convince jQuery not to assume it's in a browser
    module: { exports: {} },

    // Expose a hook for the Ember app to provide its handleURL functionality
    FastBoot: {
      resolve: appBootResolver,
      debug: emberDebug
    },

    URL: require("url")
  };

  for (var dep in dependencies) {
    sandbox[dep] = dependencies[dep];
  }

  // Set the global as `window`.
  sandbox.window = sandbox;

  // The sandbox is now a JavaScript context O_o
  Contextify(sandbox);

  return sandbox;
}

module.exports = boot;
