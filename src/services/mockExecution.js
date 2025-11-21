// mockExecution.js
// Lightweight simulated execution with small delay and receipt

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateSend(rule) {
  // simulate network & blockchain latency
  await wait(500 + Math.floor(Math.random() * 1000));

  const txHash = "MOCK_TX_" + Math.random().toString(36).slice(2, 10).toUpperCase();

  const receipt = {
    txHash,
    status: "confirmed",
    amount: rule.json.amount || null,
    to: rule.json.to || null,
    timestamp: new Date().toISOString()
  };

  return receipt;
}

async function simulateEscrowRelease(rule) {
  await wait(500 + Math.floor(Math.random() * 1000));
  const txHash = "MOCK_ESCROW_" + Math.random().toString(36).slice(2, 10).toUpperCase();
  return { txHash, status: "released", timestamp: new Date().toISOString() };
}

module.exports = { simulateSend, simulateEscrowRelease };
