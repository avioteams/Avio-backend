const dayjs = require("dayjs");
const weekday = require("dayjs/plugin/weekday");
dayjs.extend(weekday);

module.exports = {
    calculateNextRun: (rule) => {
        if (rule.trigger.type === "schedule") {
            if (rule.trigger.frequency === "weekly") {
                const day = rule.trigger.day.toLowerCase();

                const map = {
                    monday: 1,
                    tuesday: 2,
                    wednesday: 3,
                    thursday: 4,
                    friday: 5,
                    saturday: 6,
                    sunday: 0
                };

                const next = dayjs().weekday(map[day]);
                return next.isBefore(dayjs()) ? next.add(1, "week").toISOString() : next.toISOString();
            }
        }

        return dayjs().add(1, "minute").toISOString(); // fallback
    }
};
