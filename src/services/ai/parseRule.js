// Very simple rule parser for hackathon MVP
// No AI model yet — just pattern-based extraction.

function parseRule(text) {
    text = text.toLowerCase();

    let json = {
        action: null,
        amount: null,
        currency: "NGN",
        to: null,
        trigger: {},
        conditions: []
    };

    // Extract amount — ₦5000 / 5000 naira
    const amountMatch = text.match(/₦?\s?(\d{1,10})/);
    if (amountMatch) {
        json.amount = Number(amountMatch[1]);
    }

    // Extract receiver
    const toMatch = text.match(/to\s+([a-zA-Z]+)/);
    if (toMatch) {
        json.to = toMatch[1];
    }

    // Scheduling: every Friday / every Monday
    const dayMatch = text.match(/every\s+([a-z]+)/);
    if (dayMatch) {
        json.trigger = {
            type: "schedule",
            frequency: "weekly",
            day: dayMatch[1]
        };
    }

    // Detect action type: "send"
    if (text.includes("send")) {
        json.action = "send";
    }

    // Condition: "unless balance < 20000" OR "if balance < 20000"
    const conditionMatch = text.match(/balance\s*(>|<|>=|<=|==)\s*(\d+)/);
    if (conditionMatch) {
        json.conditions.push({
            left: "balance",
            operator: conditionMatch[1],
            right: Number(conditionMatch[2])
        });
    }

    return json;
}

module.exports = parseRule;
