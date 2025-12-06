// AVIO Backend Logic (Aligned to AVIO DOCS)
// Consolidated controllers, services, models, blockchain init and helpers.
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

require('dotenv').config();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { ethers } = require('ethers');
const mongoose = require('mongoose');
// Using native fetch (Node 18+) - no import required
const path = require('path');

//--------------------------------------------------
// ENV + BLOCKCHAIN CONFIG
//--------------------------------------------------
const RPC_URL = process.env.AVAX_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ESCROW_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS;
const X402_ADAPTER_ADDRESS = process.env.X402_ADAPTER;
const PAYMENT_ROUTER_ADDRESS = process.env.PAYMENT_ROUTER;
const PAYMENT_RECEIPT_NFT_ADDRESS = process.env.PAYMENT_RECEIPT_NFT;
const USER_REGISTRY_ADDRESS = process.env.USER_REGISTRY;

// optional addresses.json inside abi folder
let tokenAddresses = {};
try {
  tokenAddresses = require(path.join(__dirname, 'abi', 'addresses.json'));
} catch (e) {
  // not fatal — fallback to env or empty
  tokenAddresses = tokenAddresses || {};
}

let provider, wallet;
let contracts = {};

//--------------------------------------------------
// MONGODB MODELS (expanded to match docs)
//--------------------------------------------------
const UserSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true },
  username: { type: String },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const WalletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  address: { type: String },
  addedAt: { type: Date, default: Date.now }
});

const RuleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String },
  trigger: { type: Object },
  action: { type: Object },
  enabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  message: String,
  data: Object,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const TxHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: String,
  hash: String,
  amount: String,
  token: String,
  meta: Object,
  createdAt: { type: Date, default: Date.now }
});

const AIContextSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  context: { type: Object, default: {} },
  updatedAt: { type: Date, default: Date.now }
});

// ----- Escrow model (add this with your other mongoose model defs) -----
const EscrowSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  initiator: { type: String, required: true },
  recipient: { type: String, required: true },
  token: { type: String, required: true },
  tokenAddress: { type: String, default: null },
  amount: { type: String, required: true },      // store wei as string
  unsignedTx: { type: Object, default: {} },     // store unsigned tx payload
  txHash: { type: String, default: null },       // set after broadcast
  status: { type: String, enum: ['pending','created','broadcasted','cancelled','failed'], default: 'pending' },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const Escrow = mongoose.model('Escrow', EscrowSchema);
const User = mongoose.model('User', UserSchema);
const WalletModel = mongoose.model('Wallet', WalletSchema);
const Rule = mongoose.model('Rule', RuleSchema);
const Notification = mongoose.model('Notification', NotificationSchema);
const TxHistory = mongoose.model('TxHistory', TxHistorySchema);
const AIContext = mongoose.model('AIContext', AIContextSchema);

//--------------------------------------------------
// HELPERS
//--------------------------------------------------
function createJWT(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'aviosecret', { expiresIn: '7d' });
}

async function verifyJWT(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing token' });

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'aviosecret');
    // Attach full user object for convenience
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'Invalid token (no user)' });
    req.user = { id: user._id.toString(), wallet: user.wallet };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function weiify(amount, decimals = 18) {
  if (!amount) return '0';
  try {
    return ethers.utils.parseUnits(amount.toString(), decimals).toString();
  } catch (e) {
    // fallback: assume already hex or wei string
    return amount.toString();
  }
}


//--------------------------------------------------
// BLOCKCHAIN INITIALIZATION
//--------------------------------------------------
async function initBlockchain() {
  if (!RPC_URL || !PRIVATE_KEY) {
    console.warn('AVAX_RPC_URL or PRIVATE_KEY not set — blockchain functions will fail until provided');
  }

  provider = new ethers.providers.JsonRpcProvider(RPC_URL);
wallet = new ethers.Wallet(PRIVATE_KEY, provider);


  // Load ABIs
  const EscrowABI = require(path.join(__dirname, 'abi', 'escrow.json'));
  const ERC20ABI = require(path.join(__dirname, 'abi', 'mockERC20.json'));
  const ReceiptABI = require(path.join(__dirname, 'abi', 'PaymentReceiptNFT.json'));
  const RouterABI = require(path.join(__dirname, 'abi', 'PaymentRouter.json'));
  const UserRegistryABI = require(path.join(__dirname, 'abi', 'UserRegistry.json'));
  const X402ABI = require(path.join(__dirname, 'abi', 'X402Adapter.json'));

  // Initialize contract instances (if addresses available)
  if (ESCROW_ADDRESS) contracts.escrow = new ethers.Contract(ESCROW_ADDRESS, EscrowABI.abi, wallet);
  if (X402_ADAPTER_ADDRESS) contracts.x402 = new ethers.Contract(X402_ADAPTER_ADDRESS, X402ABI.abi, wallet);
  if (PAYMENT_ROUTER_ADDRESS) contracts.router = new ethers.Contract(PAYMENT_ROUTER_ADDRESS, RouterABI.abi, wallet);
  if (PAYMENT_RECEIPT_NFT_ADDRESS) contracts.receipt = new ethers.Contract(PAYMENT_RECEIPT_NFT_ADDRESS, ReceiptABI.abi, wallet);
  if (USER_REGISTRY_ADDRESS) contracts.userRegistry = new ethers.Contract(USER_REGISTRY_ADDRESS, UserRegistryABI.abi, wallet);

  // Expose ERC20 ABI for on-demand token instances
  contracts.ERC20ABI = ERC20ABI;

  console.log('Blockchain initialized. Contracts loaded:', Object.keys(contracts).join(', '));
}

//--------------------------------------------------
// AUTH MODULE
//--------------------------------------------------
const nonceStore = {}; // in-memory temporary store — small and ephemeral

const auth = {
  getNonce: (req, res) => {
    const walletAddress = req.query.wallet;
    if (!walletAddress) return res.status(400).json({ error: 'wallet query param required' });
    const nonce = crypto.randomBytes(16).toString('hex');
    nonceStore[walletAddress.toLowerCase()] = { nonce, createdAt: Date.now() };
    res.json({ nonce });
  },

  verifySignature: async (req, res) => {
    const { wallet: walletAddress, signature } = req.body;
    if (!walletAddress || !signature) return res.status(400).json({ error: 'wallet and signature required' });

    const entry = nonceStore[walletAddress.toLowerCase()];
    if (!entry) return res.status(400).json({ error: 'No nonce for wallet' });

    const signer = ethers.utils.verifyMessage(`AVIO Login Nonce: ${entry.nonce}`, signature);

    if (signer.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    let user = await User.findOne({ wallet: walletAddress.toLowerCase() });
    const newUser = !user;
    if (!user) user = await User.create({ wallet: walletAddress.toLowerCase() });

    const token = createJWT({ id: user._id.toString(), wallet: user.wallet });

    // remove nonce after successful login
    delete nonceStore[walletAddress.toLowerCase()];

    res.json({ token, newUser });
  },

  getSession: async (req, res) => {
    const user = await User.findById(req.user.id).lean();
    res.json({ user });
  },

  logout: async (req, res) => {
    // JWT stateless — just respond success (could implement token blacklist)
    res.json({ success: true });
  }
};

//--------------------------------------------------
// USER MODULE
//--------------------------------------------------
const user = {
  getProfile: async (req, res) => {
    const profile = await User.findById(req.user.id).lean();
    res.json({ username: profile.username, metadata: profile.metadata, createdAt: profile.createdAt });
  },

  updateProfile: async (req, res) => {
    const { username, metadata } = req.body;
    await User.findByIdAndUpdate(req.user.id, { ...(username ? { username } : {}), ...(metadata ? { metadata } : {}) });
    res.json({ success: true });
  }
};

//--------------------------------------------------
// WALLETS MODULE
//--------------------------------------------------
const wallets = {
  listWallets: async (req, res) => {
    const list = await WalletModel.find({ userId: req.user.id }).lean();
    res.json(list.map(w => ({ address: w.address, addedAt: w.addedAt })));
  },

  addWallet: async (req, res) => {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });
    await WalletModel.create({ userId: req.user.id, address: address.toLowerCase() });
    res.json({ success: true });
  },

  removeWallet: async (req, res) => {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });
    await WalletModel.deleteOne({ userId: req.user.id, address: address.toLowerCase() });
    res.json({ success: true });
  }
};

//--------------------------------------------------
// RULES MODULE
//--------------------------------------------------
const rules = {
  getRules: async (req, res) => {
    res.json(await Rule.find({ userId: req.user.id }).lean());
  },

  createRule: async (req, res) => {
    const payload = req.body;
    const created = await Rule.create({ userId: req.user.id, ...payload });
    res.json(created);
  },

  updateRule: async (req, res) => {
    await Rule.findByIdAndUpdate(req.params.id, req.body);
    res.json({ success: true });
  },

  deleteRule: async (req, res) => {
    await Rule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  }
};

//--------------------------------------------------
// X402 PAYMENT ENGINE
//--------------------------------------------------
const x402 = {
  // Prepare an unsigned transaction payload according to token type
  prepare: async (req, res) => {
    const { token, amount, recipient, tokenDecimals } = req.body;
    if (!recipient || !amount) return res.status(400).json({ error: 'recipient and amount required' });

    // amount is expected as human-readable string (e.g., "1.5") unless already wei
    let unsignedTx = {};
    try {
      if (!token || token === 'avax' || token === 'AVAX') {
        // Native AVAX transfer
        const value = weiify(amount, tokenDecimals || 18);
        unsignedTx = {
          to: recipient,
          value: value
        };
      } else {
        // token is an ERC20 contract address or symbol present in abi/addresses.json
        const tokenAddress = tokenAddresses.tokens && tokenAddresses.tokens[token.toLowerCase()] ? tokenAddresses.tokens[token.toLowerCase()] : token;
        if (!tokenAddress) return res.status(400).json({ error: 'unknown token address' });

        const ercIface = new ethers.Interface(contracts.ERC20ABI);
        const decimals = tokenDecimals || 18;
        const value = weiify(amount, decimals);
        const data = ercIface.encodeFunctionData('transfer', [recipient, BigInt(value)]);

        unsignedTx = {
          to: tokenAddress,
          data: data,
          value: '0'
        };
      }

      // gas estimation
      const estGas = await provider.estimateGas(unsignedTx);
      const gasLimit = estGas.toString();

      // chain id
      const network = await provider.getNetwork();

      res.json({ unsignedTx, gasLimit, chainId: network.chainId });
    } catch (e) {
      console.error('x402.prepare error', e);
      res.status(500).json({ error: 'failed to prepare transaction', details: e.message });
    }
  },

  // Execute a signed transaction (signed client-side)
  execute: async (req, res) => {
    const { signedTx, meta } = req.body;
    if (!signedTx) return res.status(400).json({ error: 'signedTx required' });
    try {
      const tx = await provider.sendTransaction(signedTx);
      await tx.wait(1); // wait 1 confirmation

      // record
      await TxHistory.create({ userId: req.user.id, type: 'x402-execute', hash: tx.hash, amount: (meta && meta.amount) || '', token: (meta && meta.token) || '', meta: meta || {} });

      res.json({ hash: tx.hash });
    } catch (e) {
      console.error('x402.execute error', e);
      res.status(500).json({ error: 'failed to broadcast transaction', details: e.message });
    }
  },

  history: async (req, res) => {
    const list = await TxHistory.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
    res.json(list);
  }
};

//--------------------------------------------------
// BALANCES MODULE
//--------------------------------------------------
async function getERC20Balance(tokenAddress, address) {
  try {
    const erc = new ethers.Contract(tokenAddress, contracts.ERC20ABI, provider);
    const [balance, decimals] = await Promise.all([erc.balanceOf(address), erc.decimals().catch(() => 18)]);
    return { tokenAddress, balance: balance.toString(), decimals: decimals };
  } catch (e) {
    return { tokenAddress, balance: '0', error: e.message };
  }
}

const balances = {
  getBalances: async (req, res) => {
    try {
      // fetch wallets linked to user
      const linked = await WalletModel.find({ userId: req.user.id }).lean();
      const addresses = linked.length ? linked.map(w => w.address) : [req.user.wallet];

      const results = [];
      for (const addr of addresses) {
        const native = await provider.getBalance(addr);
        const entry = { address: addr, native: native.toString(), tokens: [] };

        // If addresses.json defines tokens, fetch them
        if (tokenAddresses.tokens) {
          for (const [symbol, tokenAddr] of Object.entries(tokenAddresses.tokens)) {
            const bal = await getERC20Balance(tokenAddr, addr);
            entry.tokens.push({ symbol, address: tokenAddr, balance: bal.balance, decimals: bal.decimals });
          }
        }

        results.push(entry);
      }

      res.json(results);
    } catch (e) {
      console.error('balances.getBalances error', e);
      res.status(500).json({ error: 'failed to fetch balances', details: e.message });
    }
  }
};

//--------------------------------------------------
// NOTIFICATIONS MODULE
//--------------------------------------------------
const notifications = {
  list: async (req, res) => {
    res.json(await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean());
  },

  markRead: async (req, res) => {
    const { ids } = req.body; // optional array of notification ids
    if (Array.isArray(ids) && ids.length) {
      await Notification.updateMany({ userId: req.user.id, _id: { $in: ids } }, { read: true });
    } else {
      await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
    }
    res.json({ success: true });
  }
};

//--------------------------------------------------
// AI MODULE (DeepSeek integration)
//--------------------------------------------------
const ai = {
  getContext: async (req, res) => {
    const ctx = await AIContext.findOne({ userId: req.user.id }).lean();
    res.json({ context: ctx ? ctx.context : {}, model: process.env.DEEPSEEK_MODEL });
  },

runQuery: async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });

  const apiKey = process.env.GROQ_API_KEY;
  const model = "llama-3.1-8b-instant"; // Groq free-tier working model

  const apiUrl = "https://api.groq.com/openai/v1/chat/completions";

  if (!apiKey) return res.status(500).json({ error: 'Groq API key not configured' });

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
  model,
  messages: [
    {
      role: "system",
      content: `You are AVIO — a professional Web3 assistant.
- You speak clearly and concisely.
- You understand blockchain, crypto wallets, AVAX, ERC20s, X-Chain, EVM, and automation flows.
- When responding:
   • Be friendly, professional, and confident.
   • Format responses cleanly.
   • If a user sends a transaction command, you verify, summarize and ask for confirmation.
- NEVER output code unless requested.
- NEVER hallucinate or invent blockchain data.`
    },
    { role: "user", content: query }
  ]
})

    });

    const data = await response.json();

    if (!data || !data.choices || !data.choices[0]?.message?.content) {
      return res.status(500).json({ error: "Invalid response from AI provider", raw: data });
    }

    // Save context
    await AIContext.findOneAndUpdate(
  { userId: req.user.id },
  {
    $set: {
      model,
      lastQuery: query,
      lastResponse: data,
      updatedAt: Date.now()
    }
  },
  { upsert: true }
);
;

    res.json({ result: data.choices[0].message.content });

  } catch (e) {
    console.error("ai.runQuery error", e);
    res.status(500).json({ error: "AI provider error", details: e.message });
  }
}


};


//--------------------------------------------------
// ESCROW MODULE
//--------------------------------------------------
// -------------------- ESCROW MODULE (replace existing escrow object) --------------------
const escrow = {
  // Create escrow unsigned transaction (AVAX or ERC20) and store DB record
  create: async (req, res) => {
    try {
      const { recipient, token, amount, tokenDecimals } = req.body;
      if (!recipient || !amount)
        return res.status(400).json({ error: "recipient and amount required" });

      const initiator = req.user && req.user.wallet ? req.user.wallet : null;
      if (!initiator) return res.status(400).json({ error: "missing initiator (authenticated user required)" });

      const zeroAddress = "0x0000000000000000000000000000000000000000";
      const deadline = Math.floor(Date.now() / 1000) + 86400; // default 24h
      const receiptURI = "";

      let unsignedTx = {};
      let metadata = { token };

      // Native AVAX
      if (!token || token.toLowerCase() === "avax") {
        const value = weiify(amount, tokenDecimals || 18);

        unsignedTx = {
          to: contracts.escrow.address,
          value,
          data: contracts.escrow.interface.encodeFunctionData("createEscrow", [
            initiator,
            recipient,
            zeroAddress,
            BigInt(value),
            BigInt(deadline),
            receiptURI
          ])
        };

        metadata.type = "AVAX";
        metadata.tokenAddress = zeroAddress;
      } else {
        // ERC20 mode
        const tokenAddress = tokenAddresses.tokens?.[token.toLowerCase()] || token;
        if (!tokenAddress) return res.status(400).json({ error: "Unknown token address" });

        const value = weiify(amount, tokenDecimals || 18);

        unsignedTx = {
          to: contracts.escrow.address,
          value: "0",
          data: contracts.escrow.interface.encodeFunctionData("createEscrow", [
            initiator,
            recipient,
            tokenAddress,
            BigInt(value),
            BigInt(deadline),
            receiptURI
          ])
        };

        metadata.type = "ERC20";
        metadata.tokenAddress = tokenAddress;
      }

      // Save DB record BEFORE returning, so callers get escrowId to track
      const escrowDoc = await Escrow.create({
        userId: req.user.id,
        initiator,
        recipient,
        token: token || "avax",
        tokenAddress: metadata.tokenAddress || null,
        amount: (unsignedTx.value ? unsignedTx.value.toString() : "0"),
        unsignedTx: { ...unsignedTx }, // save the unsigned tx payload
        status: "pending",
        metadata
      });

      // Try estimateGas, fallback if it fails
      let gasLimit;
      try {
        const est = await provider.estimateGas({
          ...unsignedTx,
          from: initiator
        });
        gasLimit = est.toString();
      } catch (err) {
        console.warn("⚠️ gas estimation failed — fallback 300k", err && err.message ? err.message : err);
        gasLimit = "300000";
      }

      // Must fetch network BEFORE returning chainId
      const network = await provider.getNetwork();

      // Normalize unsignedTx for JSON (BigInt -> string)
      const normalizedUnsignedTx = {
        ...unsignedTx,
        value: unsignedTx.value ? unsignedTx.value.toString() : "0"
      };

      return res.json({
        unsignedTx: normalizedUnsignedTx,
        gasLimit: gasLimit.toString(),
        chainId: Number(network.chainId),
        escrowId: escrowDoc._id.toString(),
        metadata
      });
    } catch (err) {
      console.error("escrow.create error:", err);
      return res.status(500).json({ error: "escrow error", details: err.message });
    }
  },

  // Execute (record or broadcast) a signed transaction
  // - If client gives a tx hash (already broadcasted) -> record it to DB
  // - If client gives a raw signed tx -> attempt to broadcast via provider.sendTransaction
  execute: async (req, res) => {
    try {
      const { signedTx, escrowDbId } = req.body;
      if (!signedTx) return res.status(400).json({ error: "signedTx required" });

      // If user provided a tx hash -> record and return
      const isTxHash = /^0x([A-Fa-f0-9]{64})$/.test(signedTx);
      if (isTxHash) {
        if (escrowDbId) {
          await Escrow.findByIdAndUpdate(escrowDbId, { txHash: signedTx, status: "created" });
        }
        return res.json({ status: "recorded", hash: signedTx });
      }

      // Validate raw signed transaction simple signature (allow common prefixes)
      if (!/^0x[0-9a-fA-F]+$/.test(signedTx)) {
        return res.status(400).json({ error: "invalid_signed_tx", message: "Signed transaction must be hex." });
      }

      // Attempt broadcast
      try {
        const tx = await provider.sendTransaction(signedTx);
        const receipt = await tx.wait(1);

        // update DB if escrowDbId provided
        if (escrowDbId) {
          await Escrow.findByIdAndUpdate(escrowDbId, {
            txHash: tx.hash,
            status: "broadcasted"
          });
        }

        return res.json({
          status: "broadcasted",
          hash: tx.hash,
          blockNumber: receipt.blockNumber,
          confirmations: receipt.confirmations
        });
      } catch (broadcastErr) {
        console.warn("escrow.execute broadcast failed:", broadcastErr && broadcastErr.message ? broadcastErr.message : broadcastErr);

        // If broadcast failed due to unsupported transaction type or other provider problems,
        // return a clear error with guidance — but we will still record the signedHex length so user can inspect.
        if (escrowDbId) {
          await Escrow.findByIdAndUpdate(escrowDbId, {
            status: "failed",
            metadata: { broadcastError: (broadcastErr && broadcastErr.message) || String(broadcastErr) }
          });
        }

        return res.status(500).json({
          error: "Failed to broadcast escrow tx",
          details: broadcastErr && broadcastErr.message ? broadcastErr.message : String(broadcastErr)
        });
      }
    } catch (err) {
      console.error("escrow.execute error", err);
      return res.status(500).json({ error: "escrow execute error", details: err.message });
    }
  },

  // Prepare a cancel transaction (returns unsignedTx) — user signs & broadcasts
  cancel: async (req, res) => {
    try {
      const { escrowId } = req.body;
      if (!escrowId) return res.status(400).json({ error: "escrowId required" });

      const unsignedTx = await contracts.escrow.populateTransaction.cancelEscrow(escrowId);
      const unsignedForEstimate = { ...unsignedTx, from: req.user.wallet };

      let gasLimit;
      try {
        const estGas = await provider.estimateGas(unsignedForEstimate);
        gasLimit = estGas.toString();
      } catch (err) {
        console.warn("⚠️ Gas estimate failed for cancel — using fallback.", err && err.message ? err.message : err);
        gasLimit = "300000";
      }

      return res.json({ unsignedTx, gasLimit, chainId: (await provider.getNetwork()).chainId });
    } catch (err) {
      console.error("escrow.cancel error", err);
      return res.status(500).json({ error: "Failed to prepare cancel tx", details: err.message });
    }
  },

  // Prepare a release transaction (returns unsignedTx) — user signs & broadcasts
  // --- replace existing escrow.release with this implementation ---
release: async (req, res) => {
  try {
    const { escrowId, deadline, signature } = req.body;
    if (!escrowId) return res.status(400).json({ error: "escrowId required" });
    if (!signature) return res.status(400).json({ error: "signature required (signed typed data)" });

    // fetch DB record if present (non-fatal)
    const dbRecord = await Escrow.findOne({ escrowId }).lean().catch(() => null);

    // Build EIP-712 domain & types — MUST match on-chain/verifier
    const chain = await provider.getNetwork();
    const domain = {
      name: "Escrow",
      version: "1",
      chainId: Number(chain.chainId),
      verifyingContract: contracts.escrow.address
    };

    const types = {
      ReleaseEscrow: [
        { name: "initiator", type: "address" },
        { name: "escrowId", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };

    // Use initiator from DB if present; otherwise infer from authenticated user
    const initiator = (dbRecord && dbRecord.initiator) || (req.user && req.user.wallet);
    if (!initiator) return res.status(400).json({ error: "initiator required (authenticate or store in DB)" });

    // deadline must be provided by client (uint256 unix timestamp)
    if (!deadline) return res.status(400).json({ error: "deadline required (unix timestamp)" });

    // Verify typed-data signature: recovers the signer
    let recovered;
    try {
      recovered = ethers.verifyTypedData(domain, types, { initiator, escrowId: BigInt(escrowId), deadline: BigInt(deadline) }, signature);

    } catch (err) {
      // some providers produce signature as hex without v normalized; still try to split and verify
      console.error("verifyTypedData error:", err && err.message ? err.message : err);
      return res.status(400).json({ error: "Invalid typed-data signature" });
    }

    if (recovered.toLowerCase() !== initiator.toLowerCase()) {
      return res.status(400).json({ error: "Signature does not match initiator" });
    }

    // Split signature into v, r, s (supports ethers v6)
    let sig;
    try {
      sig = ethers.Signature.from(signature); // v6
    } catch (e) {
      sig = ethers.splitSignature(signature); // fallback
    }
    const { v, r, s } = sig;
const sigBytes = ethers.utils.joinSignature({ r, s, v });

    // Prepare and send the on-chain tx using server wallet (wallet must be configured)
    // We call releaseEscrowWithAuthorization which exists in your ABI.
   if (!contracts.escrow.interface.functions["releaseEscrowWithAuthorization(uint256,uint256,bytes)"] &&
    !contracts.escrow.interface.functions["releaseEscrowWithAuthorization(address,uint256,uint256,bytes)"]) {
  return res.status(500).json({ error: "releaseEscrowWithAuthorization ABI entry not found" });
}


    // Execute on-chain: contract connect with server wallet
    const escrowWithWallet = contracts.escrow.connect(wallet);

    // Send tx (optionally set gasLimit fallback)
    let tx;
    try {
     // Prefer bytes-signature ABI if present
if (contracts.escrow.interface.functions["releaseEscrowWithAuthorization(uint256,uint256,bytes)"]) {
  tx = await escrowWithWallet.releaseEscrowWithAuthorization(
    BigInt(escrowId),
    BigInt(deadline),
    sigBytes,
    { gasLimit: 500000n }
  );
} else {
  // fallback to address-prefixed ABI (some variants include initiator)
  tx = await escrowWithWallet.releaseEscrowWithAuthorization(
    initiator,
    BigInt(escrowId),
    BigInt(deadline),
    sigBytes,
    { gasLimit: 500000n }
  );
}

    } catch (err) {
      console.error("releaseEscrowWithAuthorization send error:", err);
      return res.status(500).json({ error: "Failed to send release tx", details: err.message });
    }

    // Wait for 1 confirmation
    const receipt = await tx.wait(1);

    // Update DB record if exists, else create simple record
    if (dbRecord) {
      await EscrowModel.findByIdAndUpdate(dbRecord._id, { status: "released", txHash: tx.hash });
    } else {
      await EscrowModel.create({
        initiator,
        recipient: (dbRecord && dbRecord.recipient) || "",
        token: (dbRecord && dbRecord.token) || "avax",
        amount: (dbRecord && dbRecord.amount) || "",
        unsignedTx: dbRecord ? dbRecord.unsignedTx : null,
        txHash: tx.hash,
        status: "released",
        escrowId: escrowId
      });
    }

    return res.json({
      status: "released",
      hash: tx.hash,
      blockNumber: receipt.blockNumber,
      confirmations: receipt.confirmations
    });

  } catch (err) {
    console.error("escrow.release error", err);
    return res.status(500).json({ error: "Failed to prepare release", details: err.message });
  }
},

  // History - returns escrow records for the user
  history: async (req, res) => {
    try {
      const list = await Escrow.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
      res.json(list);
    } catch (err) {
      console.error("escrow.history error", err);
      res.status(500).json({ error: "Failed to fetch history", details: err.message });
    }
  }
};


//--------------------------------------------------
// SYSTEM MODULE
//--------------------------------------------------
const system = {
  health: async (req, res) => {
    const dbState = mongoose.connection.readyState === 1 ? 'ok' : 'down';
    let rpcStatus = 'unknown';
    try {
      await provider.getBlockNumber();
      rpcStatus = 'ok';
    } catch (e) {
      rpcStatus = 'down';
    }

    res.json({ db: dbState, rpc: rpcStatus, uptime: process.uptime() });
  }
};

//--------------------------------------------------
// EXPORT
//--------------------------------------------------
module.exports = {
  initBlockchain,
  verifyJWT,
  auth,
  user,
  wallets,
  rules,
  x402,
  balances,
  notifications,
  ai,
  system,
  escrow
};
