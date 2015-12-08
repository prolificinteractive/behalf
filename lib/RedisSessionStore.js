var _ = require('lodash');
var Promise = require('bluebird');
var redis = require('redis');
var Session = require('./Session');

function RedisSessionStore (options) {
  _.defaults(this, options, {
    config: {},
    keyPrefix: 'sessions:'
  });

  this.client = redis.createClient(this.config);

  Promise.promisifyAll(this.client);
}

RedisSessionStore.prototype.getKey = function (sessionId) {
  return this.getKeyPrefix + sessionId;
};

RedisSessionStore.prototype.save = function (session, ttl) {
  var serializedSession = JSON.stringify(session.export());
  var key = this.getKey(session.id);

  return this.client
    .setAsync(key, serializedSession)
    .bind(this)
    .then(function () {
      if (ttl) {
        return this.client.pexpireAsync(key, ttl);
      }
    })
    .return();
};

RedisSessionStore.prototype.load = function (sessionId) {
  var key = this.getKey(sessionId);

  return this.client
    .getAsync(key)
    .then(JSON.parse)
    .then(function (exportObj) {
      return exportObj? Session.import(exportObj): null;
    });
};

RedisSessionStore.prototype.destroy = function (sessionId) {
  var key = this.getKey(sessionId);

  return this.client
    .delAsync(key)
    .return();
};

module.exports = RedisSessionStore;
