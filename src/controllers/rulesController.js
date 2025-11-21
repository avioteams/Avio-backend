const Rule = require("../db/models/ruleModel");
const aiClient = require("../services/aiClient");
const scheduler = require("../services/scheduler");
const { calculateNextRun } = require("../utils/helpers");
const { formatRule } = require("../utils/previewFormatter");

// CREATE RULE (from raw text)
exports.createRule = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Rule text is required" });

    // parse text -> JSON (AI client stub or real AI)
    const parsedRule = await aiClient.parseRule(text);

    // calculate next run
    const nextRunAt = calculateNextRun(parsedRule);

    const newRule = await Rule.create({
      userId: "demo_user",
      ruleText: text,
      json: parsedRule,
      status: "active",
      nextRunAt
    });

    // register with scheduler
    if (scheduler.registerRule) scheduler.registerRule(newRule);

    const preview = formatRule(parsedRule);

    res.status(201).json({
      message: "Rule created successfully",
      rule: newRule,
      preview
    });
  } catch (err) {
    console.error("createRule error:", err);
    res.status(500).json({ error: "Failed to create rule" });
  }
};

// GET ALL RULES
exports.getRules = async (req, res) => {
  try {
    const rules = await Rule.find().sort({ createdAt: -1 }).select("-__v");
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rules" });
  }
};

// GET single rule
exports.getRuleById = async (req, res) => {
  try {
    const rule = await Rule.findById(req.params.id);
    if (!rule) return res.status(404).json({ error: "Rule not found" });

    const preview = formatRule(rule.json);
    res.json({ rule, preview });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rule" });
  }
};

// UPDATE rule
exports.updateRule = async (req, res) => {
  try {
    const updated = await Rule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    // re-register if needed
    if (scheduler.registerRule) scheduler.registerRule(updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update rule" });
  }
};

// DELETE rule
exports.deleteRule = async (req, res) => {
  try {
    await Rule.findByIdAndDelete(req.params.id);
    res.json({ message: "Rule deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete rule" });
  }
};

// PREVIEW endpoint (parse text and return preview only, not saved)
exports.previewRule = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text required" });
    const parsed = await aiClient.parseRule(text);
    const preview = formatRule(parsed);
    res.json({ parsed, preview });
  } catch (err) {
    res.status(500).json({ error: "Failed to preview rule" });
  }
};

// STATUS endpoint (already discussed)
exports.getRuleStatus = async (req, res) => {
  try {
    const rule = await Rule.findById(req.params.id);
    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json({ status: rule.status, txHash: rule.txHash || null });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rule status" });
  }
};

// HISTORY (mock)
exports.getRuleHistory = async (req, res) => {
  try {
    const mockHistory = ruleHistoryMock(req.params.id);
    res.json(mockHistory);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
};

// Simple in-memory mock history generator (for demo)
function ruleHistoryMock(ruleId) {
  return [
    { timestamp: Date.now() - 1000 * 60 * 60, status: "completed", txHash: "MOCKTX123" },
    { timestamp: Date.now() - 1000 * 60 * 30, status: "completed", txHash: "MOCKTX456" }
  ];
}
