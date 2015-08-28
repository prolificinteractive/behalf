var should = require('should');
var _ = require('lodash');
var Promise = require('bluebird');
var behalf = require('../lib/behalf');

_.each({
  MemorySessionStore: new behalf.stores.Memory(),
  RedisSessionStore: new behalf.stores.Redis()
}, suite);

function suite (store, name) {
  describe(name, function () {
    var session;

    beforeEach(function () {
      session = behalf.createSession();
    });

    afterEach(function () {
      return store.destroy(session.id);
    });

    it('can save and load a session', function () {
      session.jar.setCookie('foo=bar', 'http://127.0.0.1');

      return store
        .save(session)
        .then(function () {
          return store.load(session.id);
        })
        .tap(function (loadedSession) {
          JSON.stringify(session).should.equal(JSON.stringify(loadedSession));
        });
    });

    it('can destroy a session', function () {
      session.jar.setCookie('foo=bar', 'http://127.0.0.1');

      return store
        .save(session)
        .bind(store)
        .then(function () {
          return store.destroy(session.id);
        })
        .then(function () {
          return store.load(session.id);
        })
        .tap(function (result) {
          (!!result).should.equal(false);
        });
    });

    it('destroys the session after specified milliseconds', function () {
      var TTL = 100;

      return store
        .save(session, TTL)
        .delay(TTL + 1)
        .then(function () {
          return store.load(session.id);
        })
        .tap(function (result) {
          (result === null).should.equal(true);
        });
    });
  });
}

module.exports = suite;
