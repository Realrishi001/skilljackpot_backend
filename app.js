import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { sequelizeCon } from './src/init/dbConnection.js';

// ===========================
// File Imports
// ===========================
import printedTickets from './src/routes/printedTickets.router.js';
import admins from './src/routes/admins.router.js';
import winningPercentage from './src/routes/winningPercentage.routes.js';
import winnings from './src/routes/getWinningNumbers.router.js';
import dashboard from './src/routes/admindashboard.router.js';
import drawRouter from './src/routes/drawloadpoint.router.js';
import summaryRouter from './src/routes/summary.router.js';
import navbarRouter from './src/routes/navbar.router.js';
import winnerMasterRouter from './src/routes/winnermaster.router.js';
import claimTicketRouter from './src/routes/claimedTickets.router.js';
import cancelTicketRouter from './src/routes/cancelTicket.router.js';
import superadminRouter from './src/routes/superadmin.router.js';
import winningNumberRouter from './src/routes/winningNumbers.router.js';
import threedRouter from './src/routes/threed.router.js';

dotenv.config();

// ===========================
// Database Sync
// ===========================
sequelizeCon
  .sync({ force: false })
  .then(() => console.log('✅ Database synced successfully'))
  .catch((err) => console.error('❌ Error syncing database', err));

// ===========================
// Express App Setup
// ===========================
const app = express();
const port = process.env.PORT || 3085;

// ===========================
// CORS Configuration (Mobile + HTTPS Safe)
// ===========================
const allowedOrigins = [
  'https://skill-king.in',
  'https://www.skill-king.in',
  'https://admin.skill-king.in',
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow Postman, curl
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`❌  CORS blocked from: ${origin}`);
    return callback(new Error('CORS not allowed for this origin'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===========================
// Root Endpoint
// ===========================
app.get('/', (req, res) => {
  res.status(200).json({
    message: "Hello, developer. You've reached the API. It's been waiting.",
    status: 'online-ish',
    warnings: ['Payment Bacha hai abhi'],
    tip: 'Payment pura kardo jaldi',
  });
});

// ===========================
// Routes
// ===========================
app.use('/api', printedTickets);
app.use('/api', admins);
app.use('/api', winningPercentage);
app.use('/api', winnings);
app.use('/api', dashboard);
app.use('/api', drawRouter);
app.use('/api', summaryRouter);
app.use('/api', navbarRouter);
app.use('/api', winnerMasterRouter);
app.use('/api', claimTicketRouter);
app.use('/api', cancelTicketRouter);
app.use('/api', superadminRouter);
app.use('/api', winningNumberRouter);
app.use('/api', threedRouter);

// ===========================
// Start Server
// ===========================
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
