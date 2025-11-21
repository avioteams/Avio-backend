module.exports.checkTrigger = async (rule) => {
  if (rule.json.trigger.type === "schedule") {
    return require('./scheduleTrigger')(rule);
  }

  if (rule.json.trigger.type === "price") {
    return require('./priceTrigger')(rule);
  }

  return false;
};
