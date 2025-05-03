// Load environment variables
require('dotenv').config();

// Import packages
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const nodemailer = require('nodemailer');
const mysql = require('mysql2');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// DEBUG: Log every request
app.use((req, res, next) => {
  console.log(`Received request: ${req.method} ${req.url}`);
  next();
});

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',  
  user: process.env.DB_USER || 'root',  
  password: process.env.DB_PASSWORD || '',  
  database: process.env.DB_NAME || '',  
  port: process.env.DB_PORT || 3306,
});

// Test MySQL connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to MySQL:', err.stack);
    return;
  }
  console.log('Connected to MySQL as ID ' + connection.threadId);
  connection.release();  // Release the connection back to the pool
});
// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'Outlook',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Payment endpoint
app.post('/create-payment', async (req, res) => {
  const { token, amount, name, email, address, cart } = req.body;

  const connection = pool.promise();
  const conn = await connection.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Insert customer
    const [customerResult] = await conn.query(
      'INSERT INTO customers (name, email, address, created_at) VALUES (?, ?, ?, NOW())',
      [name, email, address]
    );
    const customerId = customerResult.insertId;

    // 2. Insert order
    const [orderResult] = await conn.query(
      'INSERT INTO orders (customer_id, total_amount, created_at) VALUES (?, ?, NOW())',
      [customerId, amount]
    );
    const orderId = orderResult.insertId;

    // 3. Order items
    for (const item of cart) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.productId, item.quantity, item.price]
      );
    }

    // 4. Payment
    await conn.query(
      'INSERT INTO payments (order_id, stripe_token, amount, payment_status, created_at) VALUES (?, ?, ?, ?, NOW())',
      [orderId, token, amount, 'Successful']
    );

    // 5. Shipping
    await conn.query(
      'INSERT INTO shipping (order_id, address, shipping_method, status, created_at) VALUES (?, ?, ?, ?, NOW())',
      [orderId, address, 'Standard', 'Pending']
    );

    await conn.commit();

    // Stripe charge
    const charge = await stripe.charges.create({
      amount,
      currency: 'gbp',
      source: token,
      description: 'Nuru Soaps Order',
    });

    res.json({ success: true, charge });
  } catch (error) {
    await conn.rollback();
    console.error('Payment error:', error);
    res.status(500).json({ success: false, error: 'Payment processing failed' });
  } finally {
    conn.release();
  }
});

// Contact form endpoint
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: 'New Contact Form Submission - Nuru Soaps',
    html: `
      <h3>New Contact Form Message</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong><br>${message}</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Thank you for contacting us!' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ success: false, error: 'Message failed to send' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
