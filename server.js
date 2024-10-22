const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const auth = require('./06-auth-middleware');
const app = express();
const fetch = require('node-fetch');
const PORT = process.env.PORT || 3001;
const jwt = require('jsonwebtoken');

app.use(cors({
  origin: ['http://localhost:3001', 'https://homework1-ticket-app.onrender.com'],
  credentials: true,
}));
app.use(express.json());
app.use(express.static('public')); 

// postgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(auth.setUserInfo); 

app.post('/auth/token', (req, res) => {
  try {
    const payload = { app: 'ticket-app' };
    const token = jwt.sign(payload, process.env.TOKEN_KEY, { expiresIn: '2h' });

    res.json({ token });
  } catch (error) {
    console.error('Error generating token:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/ticket-count', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM tickets');
    res.json({ totalTickets: rows[0].count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/generate-ticket', auth.requiresAuthentication, async (req, res) => {
  const { vatin, firstName, lastName } = req.body;

  if (!vatin || !firstName || !lastName) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM tickets WHERE vatin = $1', [vatin]);
    if (rows[0].count >= 3) {
      return res.status(400).json({ message: 'Maximum 3 tickets per OIB' });
    }

    const ticketId = uuidv4();
    await pool.query(
      'INSERT INTO tickets (id, vatin, first_name, last_name, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [ticketId, vatin, firstName, lastName]
    );

    const ticketUrl = `${req.protocol}://${req.get('host')}/ticket/${ticketId}`;
    QRCode.toFileStream(res, ticketUrl, { type: 'png' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/callback', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'callback.html'));
});

app.get('/ticket/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ticket.html'));
});

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

app.listen(PORT, () => {
  console.log(`Server running on  http://localhost:${PORT}`);
});