const { getSlotsWithStatus, setSlotStatus } = require('../services/slotService');

async function listSlots(req, res) {
  const { id } = req.params;
  const slots = await getSlotsWithStatus(id);
  res.json(slots);
}

// Endpoint cho admin/staff sửa tay trạng thái slot (ví dụ đóng slot bảo trì = 'blocked').
// Giai đoạn 4 (booking) và giai đoạn 7 (checkin/checkout) KHÔNG viết controller
// riêng để đổi status - phải import setSlotStatus từ slotService y như file này.
async function updateSlotStatus(req, res) {
  const { id: lotId, slotId } = req.params;
  const { status } = req.body;

  try {
    const slot = await setSlotStatus(lotId, slotId, status);
    res.json(slot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { listSlots, updateSlotStatus };