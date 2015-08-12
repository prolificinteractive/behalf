var url = require('url');
var should = require('should');
var _ = require('lodash');
var express = require('express');
var Promise = require('bluebird');
var callbackify = require('../lib/callbackify');
var behalf = require('../lib/behalf');
var TEST_PORT = 10088;
var PATHNAME = '/';
var TEST_HOST = 'localhost:' + TEST_PORT;
var BASE_URL = 'http://' + TEST_HOST;
var BASE_URL_SECURE = 'https://' + TEST_HOST;

function getCookieVal (session, name) {
  return new Promise(function (resolve, reject) {
    session.jar._jar.store.findCookie('localhost', '/', name, function (err, cookie) {
      if (err) {
        return reject(err);
      }

      resolve(cookie.value);
    });
  });
}

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

  describe('Making requests', function () {
    var app;
    var server;

    beforeEach(function (done) {
      app = express();
      server = app.listen(TEST_PORT, done);
    });

    afterEach(function (done) {
      server.close(done);
    });

    describe('#request', function () {
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

      it('uses options.host by default if specified', function () {
        var session = behalf.createSession({
          host: TEST_HOST
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
          .then(function (response) {
            return getCookieVal(session, 'foo');
          })
          .tap(function (val) {
            val.should.equal('bar');
          });
      });
    });

    describe('#requestSecure', function () {
      it('prepends https:// to host to create baseUrl in request options', function () {
        var session = behalf.createSession({
          host: TEST_HOST
        });

        session
          .createRequestOptions('https', { uri: PATHNAME })
          .baseUrl
          .should.equal(BASE_URL_SECURE);
      });
    });

    describe('redirects', function () {
      it('follows redirects and consumes cookies along the way', function () {
        var session = behalf.createSession({
          host: TEST_HOST
        });

        var vals = {
          x: 'test1',
          y: 'test2',
          z: 'test3'
        };

        app.get('/1', function (req, resp) {
          resp.set({
            'Set-Cookie': 'x=' + vals.x
          });

          resp.redirect('/2');
        });

        app.get('/2', function (req, resp) {
          resp.set({
            'Set-Cookie': 'y=' + vals.y
          });

          resp.redirect('/3');
        });

        app.get('/3', function (req, resp) {
          resp.set({
            'Set-Cookie': 'z=' + vals.z
          });

          resp.send('');
        });

        return session
          .request('/1')
          .then(function () {
            return Promise
              .props(_.mapValues(vals, function (v, k) {
                return getCookieVal(session, k);
              }))
              .tap(function (result) {
                _.each(vals, function (v, k) {
                  result[k].should.equal(v);
                });
              });
          });
      });
    });
  });
});
