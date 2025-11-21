const mongoose = require("mongoose");

const ruleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    condition: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Rule", ruleSchema);
