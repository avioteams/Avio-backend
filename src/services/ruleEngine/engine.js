const blockchain = require("../blockchainMock");
const Rule = require("../../db/models/ruleModel");

module.exports = {
    processRule: async (rule) => {
        try {
            console.log("Processing rule:", rule._id);

            // 1. Mark rule as RUNNING
            await Rule.findByIdAndUpdate(rule._id, { status: "running" });

            const action = rule.json.action;

            let result;

            if (action === "send") {
                result = await blockchain.sendPayment(rule);
            } 
            else if (action === "release_escrow") {
                result = await blockchain.releaseEscrow(rule);
            } 
            else {
                console.log("Unknown action type:", action);
            }

            // 2. Mark as COMPLETED
            await Rule.findByIdAndUpdate(rule._id, {
                status: "completed",
                lastRunAt: new Date(),
                txHash: result.txHash
            });

            console.log("Rule completed:", rule._id);

        } catch (error) {
            console.error("Error processing rule:", error);

            // mark as failed
            await Rule.findByIdAndUpdate(rule._id, { status: "failed" });
        }
    }
};
