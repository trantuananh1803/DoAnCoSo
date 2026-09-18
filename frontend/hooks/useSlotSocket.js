import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Tạo 1 lần duy nhất ngoài component - tránh mỗi lần render lại mở socket mới
const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000');

/**
 * initialSlots: kết quả gọi GET /lots/:id/slots lúc mount.
 * Sau đó chỉ patch từng slot khi có event 'slot:update', không gọi lại API.
 */
export function useSlotSocket(lotId, initialSlots) {
  const [slots, setSlots] = useState(initialSlots);

  useEffect(() => {
    if (!lotId) return;

    socket.emit('join_lot', lotId);

    function handleUpdate({ lot_id, slot_id, status }) {
      if (lot_id !== lotId) return; // phòng trường hợp room lệch, lọc lại cho chắc
      setSlots((prev) => prev.map((s) => (s.id === slot_id ? { ...s, status } : s)));
    }

    socket.on('slot:update', handleUpdate);
    // socket.io tự động reconnect mặc định (reconnection: true) - không cần code tay,
    // nhưng sau khi reconnect nên fetch lại GET /slots 1 lần để đồng bộ trạng thái
    // trong lúc mất kết nối, không chỉ ngồi chờ event tiếp theo.
    socket.on('connect', () => {
      // TODO: gọi lại fetchSlots(lotId) rồi setSlots() ở đây
    });

    return () => {
      socket.emit('leave_lot', lotId);
      socket.off('slot:update', handleUpdate);
    };
  }, [lotId]);

  return slots;
}