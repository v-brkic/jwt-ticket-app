const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa'); // Use jwks-rsa to get Auth0 public keys
const dotenv = require('dotenv');
dotenv.config();

// Create a JWKS client to fetch public keys from Auth0
const jwksClient = jwksRsa({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5
});

// Function to get the signing key from Auth0
function getKey(header, callback) {
  jwksClient.getSigningKey(header.kid, function (err, key) {
    if (err) {
      callback(err, null);
    } else {
      const signingKey = key.getPublicKey(); // Get the public key for verifying the token
      callback(null, signingKey);
    }
  });
}

// Function to set user info from token in request object
function setUserInfo(req, res, next) {
  const bearerToken = req.headers.authorization?.replace(/^Bearer /, '');
  if (bearerToken) {
    jwt.verify(bearerToken, getKey, {}, (err, decodedToken) => {
      if (err) {
        return res.status(401).send("Invalid Token");
      }
      // Assuming the token contains relevant application data
      req.user = decodedToken;
      next();
    });
  } else {
    return res.status(401).send("Token not provided");
  }
}

// Middleware to require authentication for protected routes
function requiresAuthentication(req, res, next) {
  if (req.user) {
    next(); // User or application is authenticated, proceed
  } else {
    res.writeHead(401, { 'WWW-Authenticate': 'Bearer' });
    res.end('Authentication is needed');
  }
}

module.exports = { setUserInfo, requiresAuthentication };
