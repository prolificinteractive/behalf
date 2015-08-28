var Session = require('./Session');
var middleware = require('./middleware');
var MemorySessionStore = require('./MemorySessionStore');
var RedisSessionStore = require('./RedisSessionStore');

module.exports = {
  Session: Session,
  middleware: middleware,
  stores: {
    Memory: MemorySessionStore,
    Redis: RedisSessionStore
  },
  createSession: function (options) {
    return new Session(options);
  }
};
