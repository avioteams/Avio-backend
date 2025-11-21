// src/services/scheduler.js

function startScheduler() {
    console.log("⏳ Scheduler (mock) started...");

    // No DB, no rules, nothing scheduled.
    // This is only for SID demo. Real scheduler will be added later.
}

module.exports = { startScheduler };




// const Rule = require("../db/models/ruleModel");
// const ruleEngine = require("./ruleEngine/engine");

// let isRunning = false;
// const registered = new Map(); // in-memory quick lookup for registered rules

// module.exports.startScheduler = () => {
//   console.log("⏳ Scheduler started...");

//   setInterval(async () => {
//     if (isRunning) return;
//     isRunning = true;
//     try {
//       const now = new Date();
//       // find rules due to run
//       const rules = await Rule.find({
//         nextRunAt: { $lte: now },
//         status: "active"
//       });

//       for (const rule of rules) {
//         console.log("Scheduler triggering rule:", rule._id);
//         // update next run (simple weekly fallback)
//         const nextRun = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
//         await Rule.findByIdAndUpdate(rule._id, { nextRunAt: nextRun });

//         // execute rule asynchronously but wait so we don't overlap too much
//         await ruleEngine.processRule(rule);
//       }
//     } catch (err) {
//       console.error("Scheduler error:", err);
//     } finally {
//       isRunning = false;
//     }
//   }, 5000); // check every 5s
// };

// module.exports.registerRule = (rule) => {
//   try {
//     registered.set(String(rule._id), rule);
//     console.log("Registered rule:", rule._id);
//   } catch (err) {
//     console.error("registerRule err:", err);
//   }
// };

// // immediate execution helper (for demo/testing)
// module.exports.runNow = async (ruleId) => {
//   try {
//     const rule = await Rule.findById(ruleId);
//     if (!rule) throw new Error("Rule not found");
//     console.log("Immediate run requested:", ruleId);
//     return await ruleEngine.processRule(rule);
//   } catch (err) {
//     console.error("runNow error:", err);
//     throw err;
//   }
// };
