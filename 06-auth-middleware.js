const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

// Function to create JWT token (not needed for Client Credentials Flow, but keeping for any user-based flows)
function createToken(payload) {
  return jwt.sign(payload, process.env.TOKEN_KEY, { expiresIn: "2m" });
}

// Function to set user info from token in request object
function setUserInfo(req, res, next) {
  const bearerToken = req.headers.authorization?.replace(/^Bearer /, '');
  if (bearerToken) {
    try {
      const token = jwt.verify(bearerToken, process.env.TOKEN_KEY);
      // Assuming the token contains application-related data
      if (token) {
        req.user = { app: 'ticket-app' };  // You can store relevant info in req.user
      }
    } catch (err) {
      return res.status(401).send("Invalid Token");
    }
  }
  next();
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
