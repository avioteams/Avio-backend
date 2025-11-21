// previewFormatter.js
// Turn parser output (JSON rule) into a UI-friendly preview object/string.

function humanizeAmount(amount, currency = "NGN") {
  if (amount == null) return null;
  // show 2000 => "₦2,000"
  return `${currency === "NGN" ? "₦" : ""}${Number(amount).toLocaleString()}`;
}

function prettyTime(t) {
  if (!t) return null;
  return t;
}

function formatRule(parsed) {
  // parsed = output from parseInstruction()
  const preview = {
    action: parsed.action || null,
    amount: parsed.amount ? humanizeAmount(parsed.amount, parsed.currency) : null,
    percentage: parsed.percentage ? `${parsed.percentage}%` : null,
    recipient: parsed.to || null,
    trigger: parsed.trigger || null,
    conditions: parsed.conditions || []
  };

  // Build human readable summary
  let summaryParts = [];

  if (preview.action === "save" && preview.percentage) {
    summaryParts.push(`Save ${preview.percentage} of incoming funds`);
  } else if (preview.action === "send" && preview.amount && preview.recipient) {
    summaryParts.push(`Send ${preview.amount} to ${preview.recipient}`);
  } else if (preview.action === "send" && preview.amount) {
    summaryParts.push(`Send ${preview.amount}`);
  }

  // trigger description
  if (preview.trigger) {
    if (preview.trigger.type === "schedule") {
      const day = preview.trigger.day || preview.trigger.frequency || "scheduled";
      const time = prettyTime(preview.trigger.time);
      summaryParts.push(`Every ${day}${time ? " at " + time : ""}`);
    } else if (preview.trigger.type === "condition") {
      summaryParts.push(`When ${preview.trigger.condition}`);
    } else if (preview.trigger.type === "event") {
      if (preview.trigger.event === "incoming_transaction") {
        summaryParts.push(`When you receive money`);
      } else if (preview.trigger.event === "receive_code_file") {
        summaryParts.push(`When the recipient uploads a code file`);
      } else {
        summaryParts.push(`On event: ${preview.trigger.event}`);
      }
    }
  }

  // conditions
  if (preview.conditions && preview.conditions.length) {
    const condText = preview.conditions.map(c => `${c.left} ${c.operator} ${c.right}`).join(" AND ");
    summaryParts.push(`Conditions: ${condText}`);
  }

  preview.summary = summaryParts.join(" • ");

  return preview;
}

module.exports = { formatRule };
