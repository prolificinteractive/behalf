var util = require('util');
var url = require('url');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var request = require('request');
var uuid = require('uuid');
var Promise = require('bluebird');

function coerceOptions (strOrObj) {
  if (typeof strOrObj === 'string') {
    return {
      uri: strOrObj
    };
  }

  return strOrObj;
}

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

  this.jar = Promise.promisifyAll(this.jar);
}

util.inherits(Session, EventEmitter);

Session.prototype.getCookies = function (host) {
  return _
    .chain(this.export().jar.cookies)
    .filter(function (cookie) {
      if (!host) {
        return true;
      }

      var hostname = url.parse('http://' + (host || this.host)).hostname;
      return cookie.domain === hostname;
    })
    .indexBy('key')
    .value();
};

Session.prototype.getCookie = function (key, host) {
  return this.getCookies(host)[key];
};

Session.prototype.setCookie = function (key, value, url) {
  this.jar.setCookie(key + '=' + value, url);
  return this;
};

Session.prototype.request = function (options, callback) {
  return this._request('http', options, callback);
};

Session.prototype.requestSecure = function (options, callback) {
  return this._request('https', options, callback);
};

Session.prototype.requestJson = function (options, callback) {
  return this._requestJson('http', options, callback);
};

Session.prototype.requestJsonSecure = function (options, callback) {
  return this._requestJson('https', options, callback);
};

Session.import = function (exportObj) {
  var jar = request.jar();

  jar._jar._importCookiesSync(exportObj.jar);

  return new this({
    id: exportObj.id,
    jar: jar,
    host: exportObj.host,
    userAgent: exportObj.userAgent
  });
};

Session.prototype.export = function () {
  return {
    id: this.id,
    jar: this.jar._jar.serializeSync(),
    host: this.host,
    userAgent: this.userAgent
  };
};

Session.prototype.createRequestOptions = function (protocol, options) {
  if (!options) {
    options = protocol;
    protocol = 'http';
  }

  return _.merge({
    baseUrl: this.host && (protocol + '://' + this.host),
    followRedirect: false, // Manually follow redirects
    jar: this.jar,
    headers: {
      'User-Agent': this.userAgent
    }
  }, coerceOptions(options));
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
        var _parsedUrl = url.parse(response.headers.location);
        var _protocol = (_parsedUrl.protocol || protocol).replace(':', '');
        var _host = _parsedUrl.host || session.host;

        followPromise = session._request(_protocol, {
          baseUrl: _protocol + '://' + _host,
          uri: _parsedUrl.path
        });
      } else {
        followPromise = Promise.resolve(response);
      }

      followPromise.tap(session._consumeResponse.bind(session)).then(resolve);
    });
  });

  return promise.nodeify(callback);
};

Session.prototype._requestJson = function (protocol, options, callback) {
  var promise;

  options = _.defaultsDeep({}, coerceOptions(options), {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  promise = this
    ._request(protocol, options)
    .tap(function (response) {
      response.json = JSON.parse(response.body);
    });

  return promise.nodeify(callback);
};

module.exports = Session;
