// routes/bookingRoutes.js
const express = require("express");
const router = express.Router();
const { postBooking } = require("../controllers/bookingController");
const authenticate = require("../middleware/authenticateJWT");
const requireRole = require("../middleware/requireRole");

router.post("/bookings", authenticate, requireRole("customer"), postBooking);

module.exports = router;