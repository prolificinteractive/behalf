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
  describe('.import and #export', function () {
    it('can serialize and deserialize a session', function () {
      var session = behalf.createSession();

      session.jar.setCookie('foo=bar', 'http://localhost:' + TEST_PORT);

      behalf.Session
        .import(session.export())
        .jar._jar.store.idx
        .localhost['/'].foo.value.should.equal('bar');
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

    describe('#requestJson', function () {
      var session;

      beforeEach(function () {
        session = behalf.createSession({
          host: TEST_HOST
        });

        app.get(PATHNAME, function (req, resp) {
          resp.send({
            foo: 'bar',
            contentType: req.headers['content-type']
          });
        });
      });

      it('adds a .json key with parsed JSON object to response', function () {
        return session
          .requestJson(PATHNAME)
          .tap(function (response) {
            response.json.foo.should.equal('bar');
          });
      });

      it('sets application/json as Content-Type', function () {
        return session
          .requestJson(PATHNAME)
          .tap(function (response) {
            response.json.contentType.should.equal('application/json');
          });
      });
    });

    describe('#requestJsonSecure', function () {
      it('has same behavior as #requestJson but uses https protocol', function () {
        var session = behalf.createSession({
          host: TEST_HOST
        });

        session._request = function (protocol, options) {
          return Promise.resolve({
            body: '{"protocol":"'+protocol+'"}'
          });
        };

        return session
          .requestJsonSecure('/')
          .get('json')
          .tap(function (json) {
            json.protocol.should.equal('https');
          });
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
