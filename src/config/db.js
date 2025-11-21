require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

async function startServer() {
    await connectDB();  // ← MUST CONNECT FIRST
    app.listen(PORT, () => {
        console.log(`Avio backend running on port ${PORT}`);
    });
}

startServer();
