/**
 * Chạy: node test-race-condition.js
 * Mục đích: giả lập 10 request cùng đặt 1 slot cùng lúc, kỳ vọng CHỈ 1 request
 * thành công. Nếu >1 request thành công -> logic lock đang sai, quay lại
 * kiểm tra lockBooking.js trước khi làm tiếp giai đoạn sau.
 */

const { attemptLockSlot, releaseSlotLock } = require("./lockBooking");

async function simulate() {
  const slotId = "test-slot-001";
  await releaseSlotLock(slotId); // đảm bảo sạch trước khi test

  const attempts = Array.from({ length: 10 }, (_, i) =>
    attemptLockSlot(slotId, `booking-${i}`)
  );

  const results = await Promise.all(attempts);
  const successCount = results.filter((r) => r === true).length;

  console.log("Kết quả 10 request đồng thời:", results);
  console.log(`Số request thành công: ${successCount}`);
  console.log(successCount === 1 ? "✅ ĐÚNG — chống trùng hoạt động tốt" : "❌ SAI — có race condition, sửa lại lockBooking.js");

  await releaseSlotLock(slotId);
  process.exit(0);
}

simulate();
