var Session = require('./Session');

module.exports = {
  Session: Session,
  createSession: function (options) {
    return new Session(options);
  }
};
