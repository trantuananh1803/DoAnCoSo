// jobs/expireBookings.js
const cron = require('node-cron');
const pool = require('../database/db');
const { getIO } = require('../socket');

cron.schedule('*/30 * * * * *', async () => { // chạy mỗi 30s
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE bookings SET status = 'expired'
       WHERE status = 'pending' AND expires_at < now()
       RETURNING id, slot_id`
    );
    for (const row of res.rows) {
      const slotRes = await client.query(
        `UPDATE parking_slots SET status = 'empty', updated_at = now()
         WHERE id = $1 RETURNING lot_id`,
        [row.slot_id]
      );
      const lotId = slotRes.rows[0]?.lot_id;
      if (lotId) getIO().emit('slot:update', { lot_id: lotId, slot_id: row.slot_id, status: 'empty' });
    }
  } finally {
    client.release();
  }
});