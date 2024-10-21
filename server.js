const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const auth = require('./06-auth-middleware'); // Import the custom auth middleware
const app = express();
const fetch = require('node-fetch'); // Import node-fetch for Auth0 requests
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:3001', 'https://homework1-ticket-app.onrender.com'],
  credentials: true,
}));
app.use(express.json());
app.use(express.static('public'));  // Serve static files from 'public' folder

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // Required for secure connections on Render
});

// Applying middleware to set user info
app.use(auth.setUserInfo); // Custom middleware to extract user info from JWT

// Route for generating a token using client credentials
app.post('/auth/token', async (req, res) => {
  try {
    const response = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        audience: process.env.AUTH0_AUDIENCE
      })
    });

    const tokenData = await response.json();
    if (response.status !== 200) {
      return res.status(400).json({ error: tokenData.error_description || 'Error generating token' });
    }

    res.json({ token: tokenData.access_token });
  } catch (error) {
    console.error('Error generating token:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public route for total ticket count (no authentication required)
app.get('/ticket-count', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM tickets');
    res.json({ totalTickets: rows[0].count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Protected route to generate a new ticket (requires JWT Auth)
app.post('/generate-ticket', auth.requiresAuthentication, async (req, res) => {
  const { vatin, firstName, lastName } = req.body;

  if (!vatin || !firstName || !lastName) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Check if the VATIN (OIB) already has 3 tickets
    const { rows } = await pool.query('SELECT COUNT(*) FROM tickets WHERE vatin = $1', [vatin]);
    if (rows[0].count >= 3) {
      return res.status(400).json({ message: 'Maximum 3 tickets per OIB' });
    }

    // Generate a new ticket
    const ticketId = uuidv4();
    await pool.query(
      'INSERT INTO tickets (id, vatin, first_name, last_name, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [ticketId, vatin, firstName, lastName]
    );

    // Generate QR code for the ticket
    const ticketUrl = `${req.protocol}://${req.get('host')}/ticket/${ticketId}`;
    QRCode.toFileStream(res, ticketUrl, { type: 'png' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to serve the home page (index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route to serve the callback page (callback.html)
app.get('/callback', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'callback.html'));
});

// Route to serve the ticket details page (ticket.html)
app.get('/ticket/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ticket.html'));
});

// API route to fetch ticket details (used in ticket.html)
app.get('/api/ticket/:id', async (req, res) => {
  const ticketId = req.params.id;

  try {
    const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.json({ ticket: rows[0] });
  } catch (error) {
    console.error('Error fetching ticket details:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
