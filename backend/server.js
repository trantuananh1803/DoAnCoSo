require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const pool = require("./database/db");
const redis = require("./database/redisClient"); // dùng CHUNG 1 client, không tạo Redis mới ở đây nữa
const { initSocket } = require("./socket");

const app = express();
app.use(cors({ origin: "http://localhost:5173" })); // đúng port của Vite frontend, KHÔNG để "*"
app.use(express.json());

const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);

const lotsRoutes = require("./routes/lots");
app.use("/api/lots", lotsRoutes);

// ====== THÊM DÒNG NÀY ======
const bookingRoutes = require("./routes/bookingRoutes");
app.use("/api", bookingRoutes); // route thật sẽ là /api/bookings, khớp api-contract.md
// ============================


/**
 * GET /health — kiểm tra cả 3 thứ: server sống, Postgres sống, Redis sống.
 * Đây là route ĐẦU TIÊN phải chạy được trước khi code bất kỳ thứ gì khác.
 */
app.get("/health", async (req, res) => {
  const status = { server: "ok", database: "unknown", redis: "unknown" };

  try {
    await pool.query("SELECT 1");
    status.database = "ok";
  } catch (err) {
    status.database = "error: " + err.message;
  }

  try {
    await redis.ping();
    status.redis = "ok";
  } catch (err) {
    status.redis = "error: " + err.message;
  }

  res.json(status);
});

// Tách http.createServer ra khỏi app.listen() vì Socket.io cần attach
// trực tiếp vào instance http.Server, app.listen() giấu cái instance đó đi
// nên không lấy ra để gắn socket được.
const server = http.createServer(app);

// PHẢI init trước server.listen(), không thì slotService.getIO() throw lỗi
// ngay request đổi trạng thái slot đầu tiên.
initSocket(server);

// ====== THÊM DÒNG NÀY, SAU initSocket ======
// Phải require SAU initSocket(server) vì file jobs/expireBookings.js
// gọi getIO() bên trong — gọi trước khi socket init xong là undefined, bụp app.
require("./jobs/expireBookings");
// ============================================


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});