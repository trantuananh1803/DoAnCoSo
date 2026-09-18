/**
 * Logic chống đặt trùng chỗ (race condition) — ĐIỂM DỄ BUG NHẤT của đồ án.
 *
 * Nguyên tắc: kiểm tra "còn trống" và "khóa lại" PHẢI là 1 lệnh atomic duy nhất.
 * Redis SET với NX (chỉ set nếu chưa tồn tại) + EX (tự hết hạn sau N giây)
 * chính là lệnh atomic đó — không cần transaction phức tạp.
 *
 * Dùng thư viện: ioredis
 * npm install ioredis
 */

const crypto = require("crypto");
const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const LOCK_TTL_SECONDS = 300; // 5 phút để user hoàn tất thanh toán/nhận QR, hết hạn tự nhả slot

function slotLockKey(slotId) {
  return `slot_lock:${slotId}`;
}

/**
 * attemptLockSlot: thử khóa 1 slot.
 * Trả về true nếu khóa thành công (slot trước đó chưa bị ai khóa),
 * false nếu slot đã bị người khác khóa trước đó rồi.
 */
async function attemptLockSlot(slotId, bookingId) {
  // "NX" = chỉ set nếu key chưa tồn tại -> đây là bước ngăn 2 request cùng thành công
  const result = await redis.set(
    slotLockKey(slotId),
    bookingId,
    "EX",
    LOCK_TTL_SECONDS,
    "NX"
  );
  return result === "OK"; // null nếu key đã tồn tại (đã bị khóa)
}

async function releaseSlotLock(slotId) {
  await redis.del(slotLockKey(slotId));
}

/**
 * createBooking: hàm service DUY NHẤT được phép thay đổi trạng thái slot.
 * Mọi nơi khác trong code (checkin, checkout, cancel) cũng phải gọi qua
 * các hàm tương tự ở file này, không tự ý update Redis/DB rải rác nơi khác.
 */
async function createBooking({ db, slotId, userId, vehicleId }) {
  // Bước 1: sinh bookingId tạm để dùng làm giá trị lock (dễ trace log khi debug)
  const bookingId = crypto.randomUUID();

  // Bước 2: thử lock atomic — đây là bước chống trùng thật sự
  const locked = await attemptLockSlot(slotId, bookingId);
  if (!locked) {
    const err = new Error("slot_taken");
    err.statusCode = 409;
    throw err;
  }

  try {
    // Bước 3: chỉ sau khi lock Redis thành công mới đụng vào Database
    const slot = await db.query(
      `SELECT status FROM parking_slots WHERE id = $1 FOR UPDATE`,
      [slotId]
    );

    if (slot.rows[0]?.status !== "empty") {
      // Trường hợp hiếm: Redis đã hết hạn lock cũ nhưng DB chưa kịp đồng bộ.
      // Nhả lock vừa tạo và báo lỗi, KHÔNG ghi đè trạng thái linh tinh.
      await releaseSlotLock(slotId);
      const err = new Error("slot_taken");
      err.statusCode = 409;
      throw err;
    }

    const qrCode = `QR-${bookingId}`;
    const expiresAt = new Date(Date.now() + LOCK_TTL_SECONDS * 1000);

    await db.query(
      `INSERT INTO bookings (id, user_id, vehicle_id, slot_id, qr_code, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
      [bookingId, userId, vehicleId, slotId, qrCode, expiresAt]
    );

    await db.query(`UPDATE parking_slots SET status = 'reserved', updated_at = now() WHERE id = $1`, [
      slotId,
    ]);

    // Bước 4: broadcast realtime cho mọi client đang xem bản đồ
    // io.emit('slot:update', { slotId, status: 'reserved' })  <-- gọi ở tầng route, truyền io vào đây nếu cần

    return { bookingId, qrCode, expiresAt };
  } catch (err) {
    // Nếu bất kỳ bước nào ở Database lỗi, PHẢI nhả lock Redis lại,
    // không để slot bị khóa oan trong 5 phút vì lỗi không liên quan.
    await releaseSlotLock(slotId);
    throw err;
  }
}

module.exports = { attemptLockSlot, releaseSlotLock, createBooking, LOCK_TTL_SECONDS };
