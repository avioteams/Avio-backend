require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const app = require('./app');
const { initBlockchain } = require('./modules');

// ENV VARIABLES
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// CONNECT TO MONGO
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

// START SERVER
async function startServer() {
  await connectDB();
  await initBlockchain(); // Initialize Ethers provider + contracts

  const server = express();
  server.use(app);

  server.listen(PORT, () => {
    console.log(`AVIO backend running on port ${PORT}`);
  });
}

startServer();