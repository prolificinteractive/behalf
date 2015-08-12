var util = require('util');
var url = require('url');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var request = require('request');
var uuid = require('uuid');
var Promise = require('bluebird');
var callbackify = require('./callbackify');

function Session (options) {
  EventEmitter.call(this);

  _.defaults(this, options, {
    host: undefined,
    id: null,
    jar: null,
    userAgent: undefined,
  });

  if (!this.id) {
    this.id = uuid.v4();
  }

  if (!this.jar) {
    this.jar = request.jar();
  }
}

util.inherits(Session, EventEmitter);

Session.import = function (exportObj) {
  var jar = request.jar();

  jar._jar.store.idx = exportObj.cookieIndex;

  return new this({
    id: exportObj.id,
    jar: jar
  });
};

Session.prototype.export = function () {
  return {
    id: this.id,
    cookieIndex: this.jar._jar.store.idx
  };
};

Session.prototype.request = function (options, callback) {
  return this._request('http', options, callback);
};

Session.prototype.requestSecure = function (options, callback) {
  return this._request('https', options, callback);
};

Session.prototype.createRequestOptions = function (protocol, options) {
  if (!options) {
    options = protocol;
    protocol = 'http';
  }

  if (typeof options === 'string') {
    options = {
      uri: options
    };
  }

  return _.merge({
    baseUrl: this.host && (protocol + '://' + this.host),
    followRedirect: false, // Manually follow redirects
    jar: this.jar,
    headers: {
      'User-Agent': this.userAgent
    }
  }, options);
};

Session.prototype._request = function (protocol, options, callback) {
  var session = this;
  var promise;

  options = this.createRequestOptions(protocol, options);

  this.emit('request', options);

  promise = new Promise(function (resolve, reject) {
    request(options, function (err, response) {
      if (err) {
        return reject(err);
      }

      var followPromise;

      if (response.headers.location) {
        followPromise = session._request(response.headers.location);
      } else {
        followPromise = Promise.resolve(response);
      }

      followPromise.tap(session._consumeResponse.bind(session)).then(resolve);
    });
  });

  return callbackify(promise, callback);
};

Session.prototype._consumeResponse = function (response) {
  var session = this;
  var cookies = response.headers['set-cookie'];
  var uri = url.format(response.request.uri);

  if (!cookies) {
    return Promise.resolve(response);
  }

  if (typeof cookies === 'string') {
    cookies = [cookies];
  }

  _.each(cookies, function (str) {
    session.jar.setCookie(str, uri);
  });

  this.emit('cookiesUpdated');
};

module.exports = Session;
