// /api endpoint and authentication.

var log = require('./log');
var pg = require('pg');
var configuration = require('./conf');
var pgConfig = configuration.pg;
pgConfig.pg = pg;
var EmailLogin = require('email-login');
var emailLogin = new EmailLogin({
  db: new EmailLogin.PgDb(pgConfig),
  mailer: configuration.mailer,
});
var website = "http://127.0.0.1:1234";

exports.main = function (camp) {
  camp.get('/api/1/signup', signup);
  camp.get('/api/1/signin', signin);
  camp.get('/api/1/login', login);
  camp.get('/api/1/logback', logback);
  camp.get('/api/1/logout', logout);
  camp.get('/~', home);
  camp.handle(authenticate);
};

function error(code, msg, err, res) {
  if (err) { log.error(err); }
  res.statusCode = code || 500;
  res.json({errors: [msg || 'Internal Server Error']});
}

// The following should be considered a valid name: 0ééλ統𝌆
var allowedUsernames = /^[\w\xa0-\u1fff\u2c00-\u2dff\u2e80-\ud7ff\uf900-\uffef\u{10000}-\u{2fa1f}]{1,20}$/u;
var reservedNames = /^(root|app|about|demo|lib|api|doc|test|\w|\w\w)$/;

function allowedUsername(name) {
  // FIXME: Verify inexistence in database.
  return allowedUsernames.test(name) && !reservedNames.test(name);
}

function signup(req, res) {
  var email = req.data.email;
  var name = req.data.name;
  if (!allowedUsername(name)) {
    error(400, "Disallowed name", null, res);
    return;
  }
  emailConfirmation(req, res, {
    email: email,
    name: name,
    subject: 'TheFileTree account creation: confirm your email address',
    confirmUrl: function(tok) {
      return website + "/api/1/login?token=" + encodeURIComponent(tok) +
        '&name=' + encodeURIComponent(name);
    },
  }, function(err) {
    res.redirect('/app/account/signed-up.html');
  });
}

// Prepare logging back in.
function signin(req, res) {
  var email = req.data.email;
  emailConfirmation(req, res, {
    email: email,
    subject: 'TheFileTree account log in: confirm your email address',
    confirmUrl: function(tok) {
      return website + "/api/1/logback?token=" + encodeURIComponent(tok);
    },
  }, function(err) {
    res.redirect('/app/account/signed-in.html');
  });
}

// options:
// - email: address to send the email to.
// - name: (optional) name of the user to create.
// - subject: content of the email's subject line.
// - confirmUrl: function(token: String) returns the confirmation link URL.
// callback: run when the email is sent.
function emailConfirmation(req, res, options = {}, callback) {
  var email = options.email;
  var name = options.name;
  if (!email) { error(400, "Empty email", null, res); }
  emailLogin.login(function(err, token, session) {
    if (err != null) { error(500, "Sign up failed", err, res); return; }
    req.cookies.set('token', token);
    emailLogin.proveEmail({
      token: token,
      email: email,
      name: options.subject || 'TheFileTree',
      confirmUrl: options.confirmUrl,
    }, function(err) {
      if (err != null) {
        error(500, "Sending the email confirmation failed", err, res);
        return;
      }
      callback();
    });
  });
}

function login(req, res) {
  var name = req.data.name;
  emailLogin.confirmEmail(req.cookies.get('token'), req.data.token,
  function(err, token, session) {
    if (err != null) {
      res.redirect('/app/account/email-not-confirmed.html');
      return;
    }
    if (token) {
      emailLogin.setAccountData(session.email, {name: name}, function(err) {
        if (err != null) { error(500, "Login failed", err, res); return; }
        req.cookies.set('token', token);
        res.redirect('/app/account/logged-in.html');
      });
    } else {
      res.redirect('/app/account/email-not-confirmed.html');
    }
  });
}

function logback(req, res) {
  emailLogin.confirmEmail(req.cookies.get('token'), req.data.token,
  function(err, token, session) {
    if (err != null) {
      res.redirect('/app/account/email-not-confirmed.html');
      return;
    }
    if (token) {
      req.cookies.set('token', token);
      res.redirect('/app/account/logged-back.html');
    } else {
      res.redirect('/app/account/email-not-confirmed.html');
    }
  });
}

function logout(req, res) {
  var token = req.cookies.get('token');
  req.cookies.set('token');
  res.redirect('/app/account/');
  // Clearing database information is not safety-critical.
  emailLogin.logout(token, function(err) {
    if (err) { log.error(err); }
  });
}

function home(req, res) {
  if (req.user && (typeof req.user.name === 'string')) {
    res.redirect('/' + req.user.name);
  } else { res.redirect('/'); }
}

function authenticate(req, res, next) {
  emailLogin.authenticate(req.cookies.get('token'),
  function(err, authenticated, session, token) {
    if (token) { req.cookies.set('token', token); }
    if (authenticated && session.emailVerified()) {
      req.user = {
        email: session.email,
        name: session.account.data.name,
      };
    }
    next();
  });
}
exports.authenticate = authenticate;