const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

// Function to create JWT token
function createToken(payload) {
  return jwt.sign(payload, process.env.TOKEN_KEY, { expiresIn: "2m" });
}

// Function to set user info from token in request object
function setUserInfo(req, res, next) {
  const bearerToken = req.headers.authorization?.replace(/^Bearer /, '');
  if (bearerToken) {
    try {
      const token = jwt.verify(bearerToken, process.env.TOKEN_KEY);
      if (token) {
        req.user = { app: 'ticket-app' };  // Store relevant info in req.user
      }
    } catch (err) {
      return res.status(401).send("Invalid Token");
    }
  }
  next();
}

// Middleware to require authentication
function requiresAuthentication(req, res, next) {
  if (req.user) {
    next(); // User is authenticated, proceed
  } else {
    res.writeHead(401, { 'WWW-Authenticate': 'Bearer' });
    res.end('Authentication is needed');
  }
}

module.exports = { createToken, setUserInfo, requiresAuthentication };
