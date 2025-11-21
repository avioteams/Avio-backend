module.exports.checkConditions = async (rule) => {
  for (const c of rule.json.conditions) {
    const left = await resolveValue(c.left);
    const right = c.right;

    if (!compare(left, c.operator, right)) return false;
  }
  return true;
};
