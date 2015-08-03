var url = require('url');
var should = require('should');
var express = require('express');
var Promise = require('bluebird');
var callbackify = require('../lib/callbackify');
var behalf = require('../lib/behalf');
var TEST_PORT = 10088;
var PATHNAME = '/';
var BASE_URL = 'http://localhost:' + TEST_PORT;

describe('Session', function () {
  describe('#export', function () {
    it('creates a plain object of the session', function () {
      var session = behalf.createSession();
      var exportObj = session.export();
      var idxJson;

      session.jar.setCookie('foo=bar', 'http://localhost:' + TEST_PORT);

      idxJson = JSON.stringify(session.jar._jar.store.idx);

      exportObj.id.should.equal(session.id);
      JSON.stringify(exportObj.cookieIndex).should.equal(idxJson);
    });
  });

  describe('.import', function () {
    it('creates a session object from an export object', function () {
      var session = behalf.createSession();

      session.jar.setCookie('foo=bar', 'http://localhost:' + TEST_PORT);

      behalf.Session
        .import(session.export())
        .export()
        .cookieIndex
        .localhost['/']
        .foo
        .value
        .should.equal('bar');
    });
  });

  describe('#request', function () {
    var app;
    var server;

    beforeEach(function (done) {
      app = express();
      server = app.listen(TEST_PORT, done);
    });

    afterEach(function (done) {
      server.close(done);
    });

    it('uses cookies stored in jar', function () {
      var session = behalf.createSession();

      app.get(PATHNAME, function (req, resp) {
        resp.send(req.headers.cookie);
      });

      session.jar.setCookie('foo=bar', 'http://localhost:' + TEST_PORT);

      return session
        .request({
          baseUrl: 'http://localhost:' + TEST_PORT,
          uri: PATHNAME
        })
        .tap(function (response) {
          response.body.should.equal('foo=bar');
        });
    });

    it('uses the specified user agent', function () {
      var session = behalf.createSession({
        userAgent: 'Behalf Test'
      });

      app.get(PATHNAME, function (req, resp) {
        resp.send(req.headers['user-agent']);
      });

      return session
        .request({
          baseUrl: 'http://localhost:' + TEST_PORT,
          uri: PATHNAME
        })
        .tap(function (response) {
          response.body.should.equal(session.userAgent);
        });
    });

    it('uses options.baseUrl by default if specified', function () {
      var session = behalf.createSession({
        baseUrl: 'http://localhost:' + TEST_PORT
      });

      var val = 'OK';

      app.get(PATHNAME, function (req, resp) {
        resp.send(val);
      });

      return session
        .request(PATHNAME)
        .get('body')
        .tap(function (body) {
          body.should.equal(val);
        });
    });

    it('stores response cookies in the jar', function () {
      var session = behalf.createSession();

      app.get(PATHNAME, function (req, resp) {
        resp.cookie('foo', 'bar').send('');
      });

      session.jar.setCookie('foo=bar', 'http://localhost:' + TEST_PORT);

      return session
        .request({
          baseUrl: BASE_URL,
          uri: PATHNAME
        })
        .tap(function (response) {
          session.jar._jar.store.findCookie('localhost', '/', 'foo', function (err, cookie) {
            if (err) {
              return done(err);
            }

            cookie.value.should.equal('bar');
          });
        });
    });
  });
});
