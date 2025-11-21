const express = require("express");
const router = express.Router();
const scheduler = require("../services/scheduler");

router.post("/run", async (req, res) => {
  try {
    const { ruleId } = req.body;
    if (!ruleId) return res.status(400).json({ error: "ruleId required" });

    await scheduler.runNow(ruleId);
    return res.json({ success: true, message: "Triggered runNow" });
  } catch (err) {
    console.error("actions/run error:", err);
    return res.status(500).json({ error: "Failed to run rule" });
  }
});

module.exports = router;
