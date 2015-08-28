var Promise = require('bluebird');

function MemorySessionStore () {
  this.index = {};
  this._timeouts = {};
}

MemorySessionStore.prototype.save = function (session, ttl) {
  this.index[session.id] = session;
  this._timeout(session.id, ttl);
  return Promise.resolve();
};

MemorySessionStore.prototype.load = function (key) {
  return Promise.resolve(this.index[key] || null);
};

MemorySessionStore.prototype.destroy = function (sessionId) {
  clearTimeout(this._timeouts[sessionId]);
  delete this.index[sessionId];
  delete this._timeouts[sessionId];
  return Promise.resolve();
};

MemorySessionStore.prototype._timeout = function (sessionId, ttl) {
  var _this = this;

  clearTimeout(this._timeouts[sessionId]);
  delete this._timeouts[sessionId];

  if (!ttl || ttl <= 0) {
    return;
  }

  this._timeouts[sessionId] = setTimeout(function () {
    _this.destroy(sessionId);
  }, ttl);
};

module.exports = MemorySessionStore;
