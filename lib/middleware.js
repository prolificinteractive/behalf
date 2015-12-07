var util = require('util');
var _ = require('lodash');
var Session = require('./Session');

var defaults = {
  store: null,
  getKey: function (req) {
    return req.headers['session-key'];
  }
};

function managerMiddleware (options) {
  options = _.merge({}, defaults, options);

  var store = options.store;

  if (!store) {
    throw new Error('session store is required');
  }

  return function (req, resp, next) {
    var key = options.getKey(req) || null;

    req.behalf = {
      key: key,
      session: null,
      store: store
    };

    if (!key) {
      return next();
    }

    store
      .load(key)
      .tap(function (session) {
        req.behalf.session = session;

        if (!session) {
          return next();
        }

        // Wraps resp.send so we can save the session in the background
        var send = resp.send.bind(resp);

        resp.send = function (data) {
          // Express will call resp.send twice if data is an object. Must prevent this.
          if (typeof data === 'object') {
            resp.json(data);
            return;
          }

          send(data);

          if (req.behalf.session) {
            store.save(req.behalf.session).done();
          }
        };

        next();
      })
      .catch(next);
  };
}

function generateSession (defaults) {
  return function (req, resp, next) {
    var session = new Session(defaults);

    req.behalf.session = session;

    req.behalf.store
      .save(session)
      .done(next, next);
  };
}

function requiredMiddleware () {
  return function (req, resp, next) {
    if (!req.behalf.key) {
      resp.status(499);
      return next(new KeyMissingError());
    }

    if (!req.behalf.session) {
      resp.status(498);
      return next(new NotFoundError());
    }

    next();
  };
}

function optionalMiddleware () {
  return function (req, resp, next) {
    next();
  };
}

function KeyMissingError () {
  Error.call(this);
  this.code = 'session_token_missing';
  this.message = 'Session key is missing from request.';
}

util.inherits(KeyMissingError, Error);

function NotFoundError () {
  Error.call(this);
  this.code = 'session_not_found';
  this.message = 'Session could not be found.';
}

util.inherits(NotFoundError, Error);

module.exports = {
  sessionManager: managerMiddleware,
  generateSession: generateSession,
  requireSession: requiredMiddleware,
  optionalSession: optionalMiddleware,
  KeyMissingError: KeyMissingError,
  NotFoundError: NotFoundError
};
