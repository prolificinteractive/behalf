var express = require('express');
var htmlToJson = require('html-to-json');
var behalf = require('behalf');
var bodyParser = require('body-parser');
var requireSession = behalf.middleware.requireSession;
var generateSession = behalf.middleware.generateSession;
var app = express();

app.use(behalf.middleware.sessionManager({
  host: 'store.prolific.io',
  getKey: function (req) {
    return req.query.sessionId;
  }
}));

app.get('/sessions/new', [
  generateSession(),
  function (req, resp) {
    resp.send({
      sessionId: req.behalf.session.id
    });
  }
]);

app.post('/login', [
  requireSession(),
  bodyParser.json(),
  function (req, resp, next) {
    req.behalf.session
      .requestSecure({
        method: 'POST',
        uri: '/login',
        form: {
          username: req.body.email,
          password: req.body.password
        }
      })
      .then(function (html) {
        return htmlToJson.parse(html, {
          'success': function ($doc) {
            return $doc.find('#error').length === 0;
          }
        });
      })
      .tap(resp.send.bind(resp))
      .catch(next);
  }
]);

app.get('/wishlist', [
  requireSession(),
  function (req, resp, next) {
    req.behalf.session
      .requestSecure('/account/wishlist')
      .then(function (html) {
        return htmlToJson.parse(html, ['#wishlist .item', {
          'id': function ($item) {
            return $item.attr('data-id');
          },
          'name': function ($item) {
            return $item.find('.name').text().trim();
          }
        }]);
      })
      .tap(resp.send.bind(resp))
      .catch(next);
  }
]);

app.listen(process.env.PORT || 8888);
