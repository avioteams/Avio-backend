const express = require("express");
const app = express();

const rulesRoute = require("./routes/rules");
const actionsRoute = require("./routes/actions");
const aiRoute = require("./routes/ai");

const scheduler = require("./services/scheduler");
scheduler.startScheduler();

app.use(express.json());

// Routes
app.use("/rules", rulesRoute);
app.use("/actions", actionsRoute);
app.use("/ai", aiRoute);

module.exports = app;








// const express = require("express");
// const app = express();
// const rulesRoute = require("./routes/rules");
// const actionsRoute = require("./routes/actions");
// const scheduler = require("./services/scheduler");
// scheduler.startScheduler();


// app.use(express.json());

// // Routes
// app.use("/rules", rulesRoute);
// app.use("/actions", actionsRoute);

// module.exports = app;
