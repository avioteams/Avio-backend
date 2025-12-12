const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require('express');
const { auth, user, wallets, rules, x402, balances, notifications, ai, system,escrow } = require('./modules');
const { verifyJWT } = require('./modules');

const app = express();
app.use(express.json());
const cors = require("cors");

app.use(cors());


// -------------------- AUTH ROUTES --------------------
app.get('/auth/nonce', auth.getNonce);
app.post('/auth/verify', auth.verifySignature);
app.get('/auth/session', verifyJWT, auth.getSession);
app.post('/auth/logout', verifyJWT, auth.logout);

// -------------------- USER ROUTES --------------------
app.get('/user/profile', verifyJWT, user.getProfile);
app.put('/user/profile', verifyJWT, user.updateProfile);


// -------------------- WALLET ROUTES --------------------
app.get('/wallets', verifyJWT, wallets.listWallets);
app.post('/wallets/add', verifyJWT, wallets.addWallet);
app.delete('/wallets/remove', verifyJWT, wallets.removeWallet);

// -------------------- RULES ROUTES --------------------
app.get('/rules', verifyJWT, rules.getRules);
app.post('/rules', verifyJWT, rules.createRule);
app.put('/rules/:id', verifyJWT, rules.updateRule);
app.delete('/rules/:id', verifyJWT, rules.deleteRule);

// -------------------- X402 ROUTES --------------------
app.post('/x402/prepare', verifyJWT, x402.prepare);
app.post('/x402/execute', verifyJWT, x402.execute);
app.get('/x402/history', verifyJWT, x402.history);

// -------------------- BALANCES ROUTES --------------------
app.get('/balances', verifyJWT, balances.getBalances);

// -------------------- NOTIFICATION ROUTES --------------------
app.get('/notifications', verifyJWT, notifications.list);
app.post('/notifications/mark-read', verifyJWT, notifications.markRead);

// -------------------- AI ROUTES --------------------
app.get('/ai/context', verifyJWT, ai.getContext);
app.post('/ai/run', verifyJWT, ai.runQuery);

// -------------------- ESCROW ROUTES --------------------
app.post('/escrow/create', verifyJWT, escrow.create);
app.post('/escrow/execute', verifyJWT, escrow.execute);
app.post('/escrow/cancel', verifyJWT, escrow.cancel);
app.post('/escrow/release', verifyJWT, escrow.release);
app.get('/escrow/history', verifyJWT, escrow.history);


// -------------------- SYSTEM ROUTES --------------------
app.get('/system/health', system.health);


module.exports = app;

