# Behalf

## Installation

`npm install behalf --save`

## Summary

Behalf mimics the way browsers make requests and manage cookies. It provides session objects that automatically send and store cookies with each request.

For example, you can use it to parse user-specific data from a site:

```javascript
var behalf = require('behalf');
var htmlToJson = require('html-to-json');
var session = behalf.createSession({ host: 'store.prolific.io' });

session
  .requestSecure({
    method: 'POST',
    uri: '/login',
    form: {
      username: 'blitz@prolificinteractive.com',
      password: 'dogtreats'
    }
  })
  .then(function (loginResponse) {
    return session.requestSecure('/wishlist');
  })
  .get('body')
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
  .done(function (items) {
    console.log(items);
  }, function (err) {
    throw err;
  });
```

That's all it does for now. On the roadmap we have persisting sessions and `express` middleware that will automatically load `behalf` sessions based on request parameters. For now, roll your own!

## API

### `behalf.createSession(options)` or `new behalf.Session(options)`

 - `jar` - A cookie jar either made with `request` library's `request.jar()` method or a `tough-cookie` jar object. Creates a new one by default.  
 - `id` - A uuid. Automatically generated by default.  
 - `userAgent` - A user agent string to send along in the header of each request.  
 - `host` - Sets a host so that we don't have to repeat it for every request.  

### `session.request(requestOptions, [callback]) -> responsePromise`

Makes a request using the [request library](https://github.com/request/request), automatically using the stored `jar`, `host`, and `userAgent`. Supports both promises and callbacks, with a response object as the return value.

By default, Behalf will manually follow redirects so that it can consume any cookies that are sent back along the way. To disable this, simply set `followRedirect: true` in `requestOptions`.

### `session.requestSecure(requestOptions, [callback]) -> responsePromise`

Same as `session.request`, except using `https` protocol.

### `session.export() -> { id: String, cookieIndex: Object }`

Returns an object containing the session's `id` and index of cookies. Useful for serializing and persisting to a database.

### `Session.import(exportObject)`

Creates a behalf session object from an exported object.

## Roadmap

 - Session stores: provide persistence  
 - Express middleware: use session stores to automatically load and persist sessions during requests  

## Running Tests

If you're contributing, you can run tests using `npm test`.
