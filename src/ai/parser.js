// src/ai/parser.js

function parseAmount(text) {
    const naira = text.match(/₦?\s?([\d,]+)/i);
    return naira ? parseInt(naira[1].replace(/,/g, "")) : null;
}

function parsePercentage(text) {
    const pct = text.match(/(\d+)%/);
    return pct ? parseInt(pct[1]) : null;
}

function parseTime(text) {
    const time = text.match(/(\d{1,2}(?::\d{2})?\s?(AM|PM)?)/i);
    return time ? time[0] : null;
}

function parseDay(text) {
    const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday","weekend"];
    return days.find(d => text.toLowerCase().includes(d)) || null;
}

function parseDate(text) {
    const date = text.match(/(\d{1,2})(st|nd|rd|th)?\s(of\s)?([A-Za-z]+)/i);
    return date ? date[0] : null;
}

function parseCondition(text) {
    // AVAX < $30
    const crypto = text.match(/(BTC|ETH|AVAX)\s*(<|>|<=|>=)\s*\$?(\d+(\.\d+)?)/i);
    if (crypto) {
        return [{
            left: crypto[1],
            operator: crypto[2],
            right: Number(crypto[3])
        }];
    }

    // Balance conditions
    const balance = text.match(/balance\s*(<|>|<=|>=)\s*₦?([\d,]+)/i);
    if (balance) {
        return [{
            left: "balance",
            operator: balance[1],
            right: parseInt(balance[2].replace(/,/g, ""))
        }];
    }

    // Spending conditions
    const spending = text.match(/spend(?:ing)?\s*more than\s*₦?([\d,]+)/i);
    if (spending) {
        return [{
            left: "spending",
            operator: ">",
            right: parseInt(spending[1].replace(/,/g, ""))
        }];
    }

    return null;
}

function parseTrigger(text) {
    const lower = text.toLowerCase();

    // incoming money
    if (/any money i receive|credit alert|someone sends me money|income/i.test(lower)) {
        return { type: "incoming_transaction" };
    }

    // salary
    if (/salary/i.test(lower)) {
        return { type: "salary_received" };
    }

    // repayment
    if (/pays back|pay back/i.test(lower)) {
        return { type: "repayment_received" };
    }

    // after an action
    if (/after.*sends/i.test(lower)) {
        return {
            type: "event_after",
            event: text.match(/after (.*)/i)?.[1] || "external_event"
        };
    }

    // spending category
    if (/buy food|buy.*data|buy.*airtime|transport/i.test(lower)) {
        return {
            type: "spending_category",
            category: lower.includes("food") ? "food" :
                      lower.includes("transport") ? "transport" :
                      lower.includes("data") ? "data" :
                      lower.includes("airtime") ? "airtime" : "general"
        };
    }

    // conditional (if balance < x)
    if (/if/i.test(lower) && parseCondition(text)) {
        return {
            type: "conditional",
            condition: parseCondition(text)
        };
    }

    // scheduled routines
    const day = parseDay(text);
    const time = parseTime(text);

    if (day || /daily|weekly|monthly|month|weekend/.test(lower)) {
        return {
            type: "schedule",
            frequency: lower.includes("daily") ? "daily" :
                       lower.includes("weekly") ? "weekly" :
                       lower.includes("weekend") ? "weekend" :
                       lower.includes("monthly") ? "monthly" : null,
            day: day,
            time: time,
            date: parseDate(text)
        };
    }

    return null;
}

function parseAction(text) {
    if (/send/i.test(text)) return "send";
    if (/save/i.test(text)) return "save";
    if (/move/i.test(text)) return "move";
    if (/lock/i.test(text)) return "lock";
    if (/alert/i.test(text)) return "alert";
    return "unknown";
}

function parseRecipient(text) {
    const match = text.match(/to\s([A-Za-z]+)/i);
    return match ? match[1] : null;
}

function parseInstruction(text) {
    const action = parseAction(text);
    const amount = parseAmount(text);
    const percentage = parsePercentage(text);
    const trigger = parseTrigger(text);
    const conditions = parseCondition(text);
    const to = parseRecipient(text);
    const time = parseTime(text);
    const day = parseDay(text);

    return {
        action,
        amount,
        currency: amount ? "NGN" : null,
        percentage,
        to,
        trigger,
        conditions,
        schedule: {
            day,
            time,
            date: parseDate(text)
        }
    };
}

module.exports = { parseInstruction };
