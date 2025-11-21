module.exports = {
    parseRule: async (text) => {
        console.log("Parsing rule (stub)…");

        // TEMP FAKE AI — until avio/ai is ready
        return {
            action: "send",
            amount: 5000,
            currency: "NGN",
            to: "bolu",
            trigger: {
                type: "schedule",
                frequency: "weekly",
                day: "friday"
            },
            conditions: []
        };
    }
};
