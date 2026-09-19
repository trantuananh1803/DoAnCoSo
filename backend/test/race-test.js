// test/race-test.js
const axios = require('axios');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZWIwMmEyOGEtMzNlOS00ZjMwLWE2ZWEtYmVlNTczYTNhNWY0Iiwicm9sZSI6ImN1c3RvbWVyIiwiaWF0IjoxNzg5ODI5NzYwLCJleHAiOjE3ODk4MzY5NjB9.oUSXt3Ah1Z3vJciJpdzCa4VonLws6uc_2tSKlMfipTM';
const SLOT_ID = '7f7d4fba-70e2-48c6-96c7-3c56103d8693';

async function attempt(i) {
  try {
    const res = await axios.post('http://localhost:3000/api/bookings',
      { vehicle_id:'000598be-b2df-48d1-910e-3906a3be5560', slot_id: SLOT_ID },
      { headers: { Authorization: `Bearer ${TOKEN}` } });
    console.log(`Request ${i}: SUCCESS`, res.data.booking.id);
  } catch (err) {
    console.log(`Request ${i}: FAIL`, err.response?.status, err.response?.data?.error);
  }
}

Promise.all(Array.from({ length: 10 }, (_, i) => attempt(i)));