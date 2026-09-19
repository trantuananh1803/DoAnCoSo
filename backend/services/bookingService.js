// services/bookingService.js
const redisClient = require('../database/redisClient');
const pool = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { getIO } = require('../socket');

const LOCK_TTL_SECONDS = 300; // 5 phút để thanh toán/checkin, hết hạn thì nhả slot

class SlotTakenError extends Error {}

async function createBooking(userId, vehicleId, slotId) {
  const slotRes = await pool.query(
    `SELECT lot_id, status FROM parking_slots WHERE id = $1`,
    [slotId]
  );
  if (slotRes.rowCount === 0) throw new Error('slot_not_found');
  const { lot_id: lotId } = slotRes.rows[0];

  const bookingId = uuidv4();
  const lockKey = `booking_lock:${lotId}:${slotId}`;
  const lockValue = `reserved:${bookingId}`;

  const ok = await redisClient.set(lockKey, lockValue, 'NX', 'EX', LOCK_TTL_SECONDS);
  if (!ok) throw new SlotTakenError('slot_taken');

  let qrToken; // ← KHAI BÁO Ở ĐÂY, ngoài try, để sống được tới dòng return cuối

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    qrToken = jwt.sign({ booking_id: bookingId }, process.env.JWT_SECRET, { expiresIn: '5m' }); // bỏ "const", chỉ gán

    await client.query(
      `INSERT INTO bookings (id, user_id, vehicle_id, slot_id, qr_code, status, expires_at)
       VALUES ($1,$2,$3,$4,$5,'pending', now() + interval '5 minutes')`,
      [bookingId, userId, vehicleId, slotId, qrToken]
    );

    await client.query(
      `UPDATE parking_slots SET status = 'reserved', updated_at = now() WHERE id = $1`,
      [slotId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    await redisClient.del(lockKey);
    throw err;
  } finally {
    client.release();
  }

  getIO().emit('slot:update', { lot_id: lotId, slot_id: slotId, status: 'reserved' });

  return { bookingId, qrToken };
}

module.exports = { createBooking, SlotTakenError };