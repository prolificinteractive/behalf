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
    baseUrl: undefined,
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
  var session = this;
  var promise;

  if (typeof options === 'string') {
    options = {
      uri: options
    };
  }

  options = _.defaultsDeep({}, options, {
    baseUrl: this.baseUrl,
    followRedirect: false, // Manually follow redirects
    jar: this.jar,
    headers: {
      'User-Agent': this.userAgent
    }
  });

  this.emit('request', options);

  promise = new Promise(function (resolve, reject) {
    request(options, function (err, response) {
      if (err) {
        return reject(err);
      }

      var followPromise;

      if (response.headers.location) {
        followPromise = session.request(response.headers.location);
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
