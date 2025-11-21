// src/routes/ai.js

const express = require("express");
const router = express.Router();

const { parseInstruction } = require("../ai/parser");

// POST /ai/parse
router.post("/parse", (req, res) => {
    const { instruction } = req.body;

    if (!instruction) {
        return res.status(400).json({
            error: "Instruction is required",
        });
    }

    try {
        const parsed = parseInstruction(instruction);

        return res.json({
            success: true,
            parsedRule: parsed,
        });

    } catch (error) {
        console.error("AI Parsing Error:", error);

        return res.status(500).json({
            success: false,
            error: "Failed to parse instruction",
        });
    }
});

module.exports = router;
