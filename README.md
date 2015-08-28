# Behalf

## Installation

`npm install behalf --save`

## Summary

Behalf mimics the way browsers make requests and manage cookies. It provides session objects that automatically send and store cookies with each request, as well as Express middleware that allows you to automatically load sessions within requests.

## Example

```javascript
var session = behalf.createSession({ host: 'amazon.com' });

session
  .requestSecure({
    method: 'POST',
    uri: '/login',
    form: {
      email: 'blitz@prolificinteractive.com',
      password: 'dogtreats'
    }
  })
  .then(function () {
    return session.requestSecure('/wishlist'); // Session automatically sends cookies along
  })
  .get('body')
  .done(doStuffWithWishlistPage);
```

## Contents

[API](#api)
 - [behalf.createSession](#behalfcreatesessionoptions-or-new-behalfsessionoptions)
 - [behalf.Session.import](#sessionimportexportobject)
 - [session.export](#sessionexport-id-string-host-string-useragent-string-jar-object)
 - [session.request](#sessionrequestrequestoptions-callback-responsepromise)
 - [session.requestSecure](#sessionrequestsecurerequestoptions-callback-responsepromise)
 - [session.requestJson](#sessionrequestjsonrequestoptions-callback-responsepromise)
 - [session.requestJsonSecure](#sessionrequestjsonsecurerequestoptions-callback-responsepromise)

[Middleware](#middleware)
 - [behalf.middleware.sessionManager](#behalfmiddlewaresessionmanageroptions)
 - [behalf.middleware.generateSession](#behalfmiddlewaregeneratesession)
 - [behalf.middleware.requireSession](#behalfmiddlewarerequiresession)

[Session Stores](#session-stores)
 - [behalf.stores.Redis](#new-behalfstoresredisoptions)
 - [behalf.stores.Memory](#new-behalfstoresmemory)
 - [Rolling Your Own](#rolling-your-own-session-store)

[Contributing](#contributing)

## API

### `behalf.createSession(options)` or `new behalf.Session(options)`

 - `jar` - A cookie jar either made with `request` library's `request.jar()` method or a `tough-cookie` jar object. Creates a new one by default.  
 - `id` - A uuid. Automatically generated by default.  
 - `userAgent` - A user agent string to send along in the header of each request.  
 - `host` - Sets a host so that we don't have to repeat it for every request.  

### `Session.import(exportObject)`

Creates a behalf session object from an exported object.

### `session.export() -> { id: String, host: String, userAgent: String, jar: Object }`

Returns an object containing the session's `id` and cookie jar. Useful for serializing and persisting to a database.

### `session.request(requestOptions, [callback]) -> responsePromise`

Makes a request using the [request library](https://github.com/request/request), automatically using the stored `jar`, `host`, and `userAgent`. Supports both promises and callbacks, with a response object as the return value.

By default, Behalf will manually follow redirects so that it can consume any cookies that are sent back along the way. To disable this, simply set `followRedirect: true` in `requestOptions`.

### `session.requestSecure(requestOptions, [callback]) -> responsePromise`

Same as `session.request`, except using `https` protocol.

### `session.requestJson(requestOptions, [callback]) -> responsePromise`

Sets the `Content-Type` header to "application/json" and adds a `json` key to the response object, which contains the parsed body.

### `session.requestJsonSecure(requestOptions, [callback]) -> responsePromise`

Same as `session.requestJson` but with HTTPS as the protocol.

## Express Middleware

The library also includes a set of Express middleware to manage the automatic loading and saving of sessions, which is very useful for applications that wrap around websites (see examples/ folder).

### `behalf.middleware.sessionManager(options)`

This middleware extracts a session key from the request, then loads a session. Example:

```javascript
var sessions = new behalf.middleware.sessionManager(
  store: new behalf.stores.Redis(),
  getKey: function (req) {
    return req.headers['session-key'];
  }
);

app.use(sessions);
```

Options:
 - `store` - An instance of a session store. Behalf comes with two: `behalf.stores.Memory` and `behalf.stores.Redis`. See ["Session Stores"](#session-stores) to learn more.
 - `getKey` - A function that extracts and returns the session key from the Express request object.

Now you'll get an object attached to the Express request object under the `behalf` property that contains the session context. It has these properties:
 - `key` - The session key, or `null`, extracted with the `getKey` function.
 - `session` - The loaded `behalf.Session` instance, or `null`.

In this example, we proxy Amazon's homepage. If the user has logged in using a Behalf session request, the cookies will trigger the site to serve that user's personalized homepage rather than the generic one:

```javascript
app.get('/', function (req, resp, next) {
  req.behalf.session
    .request('http://amazon.com')
    .done(resp.send.bind(resp), next);
});
```

### `behalf.middleware.requireSession()`

This middleware ensures that there will be a session, or throws an error. If no session key is found in the request, it will return a `499` status code. If a key is found but can't be retrieved from the store, a `498` status code is returned.

Example:
```javascript
app.get('/wishlist', behalf.middleware.requireSession(), function (req, resp, next) {
  req.behalf.session
    .request('http://amazon.com/account/wishlist')
    .done(resp.send.bind(resp), next);
});
```

### `behalf.middleware.generateSession()`

Creates a new session. This is useful for providing an endpoint that grants session keys:

```javascript
app.get('/sessions/new', [
  behalf.middleware.generateSession(),
  function (req, resp) {
    resp.send({
      sessionId: req.behalf.session.id
    });
  }
]);
```

## Session Stores

Behalf includes two session stores, one in-memory and one for Redis.

### `new behalf.stores.Redis(options)`

Options:
 - `client` - _Optional_. If you want to configure the connection, you can pass your own Redis client instance.
 - `keyPrefix` - _Optional_. Prepended to every Redis key that sessions are stored against. Default: "sessions:"

### `new behalf.stores.Memory()`

Stores sessions within the memory of the running process. Recommended for development use only.

### Rolling Your Own Session Store

If you want to use a different kind of database, the interface for a store is very simple. There are 3 required methods: `save`, `load`, and `destroy`.

#### .save

The save method takes a `behalf.Session` instance and an optional TTL, and should return a promise. The promise shouldn't resolve with a value. You should always use the `session.export` method to serialize the session instance. Here's a pseudo-example:

```javascript
MyStore.prototype.save = function (session, ttl) {
  var exportObj = session.export();

  exportObj.jar = JSON.stringify(exportObj.jar);

  return this.db
    .insert('sessions', exportObj)
    .then(function () {
      if (ttl) {
        return messageQueue.cancel('destroySession', { id: session.id });
      }
    })
    .then(function () {
      return messageQueue.push('destroySession', { id: session.id }, ttl);
    })
    .return();
}
```

#### .load

The load method takes a session ID string as an argument and returns a promise that resolves to a `behalf.Session` instance. Use `behalf.Session.import` to deserialize the exported object.

```javascript
MyStore.prototype.load = function (sessionId) {
  return this.db
    .select('sessions', sessionId)
    .tap(function (exportObj) {
      exportObj.jar = JSON.parse(exportObj.jar);
    })
    .then(behalf.Session.import);
}
```

#### .destroy

Takes a session ID string as an argument and returns a promise that resolves with no value:

```javascript
MyStore.prototype.destroy = function (sessionId) {
  return this.db
    .delete('sessions', sessionId)
    .return();
}
```

#### Testing Your Session Store

Test your interface by using the test suite:

```javascript
require('behalf/test/session-store-test')(new MyStore(), 'MyStore');
```

## Contributing

Run tests using `npm test`.
