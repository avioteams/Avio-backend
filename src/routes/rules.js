const express = require("express");
const router = express.Router();
const controller = require("../controllers/rulesController");

// existing routes
router.post("/", controller.createRule);
router.get("/", controller.getRules);

// new routes
router.get("/:id", controller.getRuleById);
router.get("/:id/history", controller.getRuleHistory);
router.get("/:id/status", controller.getRuleStatus);
// ... existing imports
// existing routes...
router.post("/preview", controller.previewRule);

module.exports = router;
