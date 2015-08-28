var url = require('url');
var should = require('should');
var _ = require('lodash');
var express = require('express');
var Promise = require('bluebird');
var request = require('request');
var behalf = require('../lib/behalf');
var TEST_PORT = 10088;
var PATHNAME = '/';
var TEST_HOST = 'localhost:' + TEST_PORT;
var BASE_URL = 'http://' + TEST_HOST;
var BASE_URL_SECURE = 'https://' + TEST_HOST;

describe('middleware', function () {
  var store = new behalf.stores.Memory();
  var app;
  var server;
  var session;

  beforeEach(function (done) {
    app = express();
    server = app.listen(TEST_PORT, done);
    session = behalf.createSession({
      host: TEST_HOST
    });

    app.use(behalf.middleware.sessionManager({
      store: store,
      getKey: function (req) {
        return req.query.sessionId;
      }
    }));

    app.get(PATHNAME, function (req, resp) {
      resp.cookie('foo', 'bar');
      resp.send(req.behalf.session && req.behalf.session.export());
    });
  });

  afterEach(function (done) {
    server.close(done);
  });

  describe('session manager', function () {
    it('loads sessions from store using ID extracted with provided getKey function', function () {
      return store
        .save(session)
        .then(function () {
          return session.requestJson({
            uri: PATHNAME,
            qs: {
              sessionId: session.id
            }
          });
        })
        .get('json')
        .tap(function (result) {
          result.id.should.equal(session.id);
        });
    });

    it('saves the session after sending response', function () {
      return store
        .save(session)
        .then(function () {
          return session.requestJson({
            uri: PATHNAME,
            qs: {
              sessionId: session.id
            }
          });
        })
        .then(function (response) {
          return store
            .load(session.id)
            .tap(function (loadedSession) {
              loadedSession.getCookie('foo').value.should.equal('bar');
            });
        });
    });
  });

  describe('requireSession middleware', function () {
    var PATHNAME = '/needsSession';

    beforeEach(function () {
      app.get(PATHNAME, behalf.middleware.requireSession(), function (req, resp) {
        resp.send({ abc: '123' });
      });

      // Prevent error output to stdout
      app.use(function (err, req, resp, next) {
        resp.send({
          error: err
        });
      });
    });

    it('throws a 498 error if a session is not found', function () {
      return session
        .requestJson({
          uri: PATHNAME,
          qs: {
            'sessionId': 'dummy token'
          }
        })
        .tap(function (response) {
          var err = new behalf.middleware.NotFoundError();
          response.statusCode.should.equal(498);
          response.json.error.code.should.equal(err.code);
        });
    });

    it('throws a 499 error if a session key is not passed', function () {
      return session
        .requestJson(PATHNAME)
        .tap(function (response) {
          var err = new behalf.middleware.KeyMissingError();
          response.statusCode.should.equal(499);
          response.json.error.code.should.equal(err.code);
        });
    });
  });

  describe('optionalSession middleware', function () {
    it('does nothing, as it is the default behavior', function () {
      var PATHNAME = '/optionalTest';

      app.get(PATHNAME, behalf.middleware.optionalSession(), function (req, resp) {
        resp.send(req.behalf);
      });

      return session
        .requestJson(PATHNAME)
        .get('json')
        .tap(function (json) {
          (json.key === null).should.equal(true);
          (json.session === null).should.equal(true);
        });
    });
  });

  describe('generateSession middleware', function () {
    it('creates a new session to use within the route handler', function () {
      var PATHNAME = '/optionalTest';

      app.get(PATHNAME, behalf.middleware.generateSession(), function (req, resp) {
        resp.send(req.behalf.session.export());
      });

      return session
        .requestJson(PATHNAME)
        .get('json')
        .tap(function (json) {
          json.id.should.be.type('string');
        });
    });
  });
});
