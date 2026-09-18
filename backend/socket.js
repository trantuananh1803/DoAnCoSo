const { Server } = require('socket.io');

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' },
  });

  io.on('connection', (socket) => {
    // Client join theo room lot_id -> chỉ nhận update của đúng bãi đang xem,
    // không broadcast toàn bộ hệ thống cho mọi client (tốn băng thông vô ích)
    socket.on('join_lot', (lotId) => {
      socket.join(`lot:${lotId}`);
    });

    socket.on('leave_lot', (lotId) => {
      socket.leave(`lot:${lotId}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io chưa init. Gọi initSocket(server) trong app.js trước.');
  return io;
}

module.exports = { initSocket, getIO };