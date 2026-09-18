const pool = require('../database/db');
const redis = require('../database/redisClient');
const { getIO } = require('../socket');

const VALID_STATUSES = ['empty', 'reserved', 'occupied', 'blocked'];

function slotKey(lotId, slotId) {
  return `slot:${lotId}:${slotId}`;
}

/**
 * ĐÂY LÀ HÀM DUY NHẤT TRONG TOÀN BỘ HỆ THỐNG được phép đổi trạng thái slot.
 * Giai đoạn 4 (booking), giai đoạn 7 (checkin/checkout), admin sửa tay sau này
 * -> TẤT CẢ phải gọi qua hàm này. Cấm viết UPDATE parking_slots hay redis.set()
 * rải rác ở chỗ khác, không thì y như cảnh báo trong roadmap: DB và Redis lệch
 * nhau, hiển thị sai mà không biết lỗi ở đâu.
 *
 * Thứ tự bắt buộc: Postgres (nguồn sự thật) -> Redis (cache tốc độ) -> WebSocket
 * (thông báo). Nếu Postgres fail thì throw luôn, không đụng vào Redis/socket.
 */
async function setSlotStatus(lotId, slotId, newStatus) {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error(`Trạng thái không hợp lệ: ${newStatus}`);
  }

  const { rows } = await pool.query(
    `UPDATE parking_slots
     SET status = $1, updated_at = now()
     WHERE id = $2 AND lot_id = $3
     RETURNING id, lot_id, slot_code, status`,
    [newStatus, slotId, lotId]
  );

  if (rows.length === 0) {
    throw new Error('Slot không tồn tại trong bãi này');
  }

  const slot = rows[0];

  await redis.set(slotKey(lotId, slotId), newStatus);

  getIO().to(`lot:${lotId}`).emit('slot:update', {
    lot_id: lotId,
    slot_id: slotId,
    status: newStatus,
  });

  return slot;
}

/**
 * Đọc danh sách slot + trạng thái: ưu tiên Redis (nhanh), fallback DB nếu
 * Redis miss (mới restart server, chưa từng cache, hoặc Redis vừa rớt).
 * Đúng theo API contract: "đọc từ Redis, fallback DB".
 */
async function getSlotsWithStatus(lotId) {
  const { rows: slots } = await pool.query(
    `SELECT id, lot_id, grid_cell_id, slot_code, status
     FROM parking_slots WHERE lot_id = $1 ORDER BY slot_code`,
    [lotId]
  );

  if (slots.length === 0) return [];

  const keys = slots.map((s) => slotKey(lotId, s.id));
  const cached = await redis.mget(keys); // 1 lệnh duy nhất, không loop từng slot gọi Redis

  return slots.map((s, i) => ({
    ...s,
    status: cached[i] || s.status,
  }));
}

module.exports = { setSlotStatus, getSlotsWithStatus, slotKey, VALID_STATUSES };