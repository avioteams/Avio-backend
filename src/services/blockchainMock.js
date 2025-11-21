const { simulateSend, simulateEscrowRelease } = require("./mockExecution");

// wrapper that the engine calls
module.exports = {
  sendPayment: async (rule) => {
    console.log(`[blockchainMock] sendPayment for rule ${rule._id}`);
    const receipt = await simulateSend(rule);
    // optionally store receipt somewhere (omitted for brevity)
    return receipt;
  },

  releaseEscrow: async (rule) => {
    console.log(`[blockchainMock] releaseEscrow for rule ${rule._id}`);
    const receipt = await simulateEscrowRelease(rule);
    return receipt;
  }
};
