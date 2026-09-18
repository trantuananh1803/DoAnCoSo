const express = require('express');
const router = express.Router();

const lotsController = require('../controllers/lotsController');
const slotsController = require('../controllers/slotsController');
const authenticateJWT = require('../middleware/authenticateJWT'); // file thật mày đã có
const requireRole = require('../middleware/requireRole');         // file thật mày đã có

router.get('/', authenticateJWT, lotsController.listLots);
router.get('/:id/grid', authenticateJWT, lotsController.getGrid);
router.post('/', authenticateJWT, requireRole(['admin']), lotsController.createLot);

router.get('/:id/slots', authenticateJWT, slotsController.listSlots);
router.patch(
  '/:id/slots/:slotId/status',
  authenticateJWT,
  requireRole(['admin', 'staff']),
  slotsController.updateSlotStatus
);

module.exports = router;