// controllers/bookingController.js
const { createBooking, SlotTakenError } = require('../services/bookingService');

async function postBooking(req, res) {
  const { vehicle_id, slot_id } = req.body;
  if (!vehicle_id || !slot_id) return res.status(400).json({ error: 'missing_fields' });

  try {
    const { bookingId, qrToken } = await createBooking(req.user.user_id, vehicle_id, slot_id);
    return res.status(201).json({ booking: { id: bookingId, status: 'pending' }, qr_code: qrToken });
  } catch (err) {
    if (err instanceof SlotTakenError) {
      return res.status(409).json({ error: 'slot_taken' });
    }
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

module.exports = { postBooking };