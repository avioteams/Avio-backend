module.exports.executeAction = async (rule) => {
  if (rule.json.action === "send") {
    return require('../blockchainMock').send(rule);
  }

  if (rule.json.action === "release") {
    return require('../blockchainMock').releaseEscrow(rule);
  }
};
