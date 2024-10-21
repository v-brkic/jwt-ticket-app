const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa'); // Import jwks-rsa to fetch Auth0 public keys
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
    const signingKey = key.getPublicKey(); // Get the public key for verifying the token
    callback(null, signingKey);
  });
}

// Function to set user info from token in request object
function setUserInfo(req, res, next) {
  const bearerToken = req.headers.authorization?.replace(/^Bearer /, '');
  if (bearerToken) {
    try {
      // Verify the token using the Auth0 public key
      jwt.verify(bearerToken, getKey, {}, (err, decodedToken) => {
        if (err) {
          return res.status(401).send("Invalid Token");
        }
        // Assuming the token contains relevant application data
        req.user = { app: 'ticket-app', ...decodedToken };  // You can store decoded token info in req.user
        next(); // Proceed to the next middleware
      });
    } catch (err) {
      return res.status(401).send("Invalid Token");
    }
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

module.exports = { createToken, setUserInfo, requiresAuthentication };
