# API Contract — Hệ thống bãi đỗ xe thông minh

Base URL: `/api`
Auth: Bearer JWT trong header `Authorization: Bearer <token>` (trừ các route auth)

## 1. Auth
| Method | Endpoint | Role | Body | Response |
|---|---|---|---|---|
| POST | `/auth/register` | public | `{full_name, email, password}` | `{user, token}` |
| POST | `/auth/login` | public | `{email, password}` | `{user, token}` |
| GET | `/auth/me` | any (đã login) | - | `{user}` |

## 2. Vehicles (thiếu ở bản đầu — bổ sung, cần trước khi đặt chỗ)
| Method | Endpoint | Role | Body | Response |
|---|---|---|---|---|
| GET | `/vehicles` | owner (đã login) | - | Danh sách xe của user hiện tại (lấy `user_id` từ JWT) |
| POST | `/vehicles` | customer | `{license_plate, vehicle_type}` | `201 {vehicle}` |
| DELETE | `/vehicles/:id` | owner | - | `204` |

> `POST /bookings` ở mục 5 cần `vehicle_id` hợp lệ — bắt buộc khách hàng phải có ít nhất 1 xe trước khi đặt chỗ. Backend phải kiểm tra `vehicle_id` đó thuộc đúng `user_id` đang đăng nhập, không cho đặt hộ bằng xe của người khác.

## 3. Parking Lots & Grid
| Method | Endpoint | Role | Mô tả |
|---|---|---|---|
| GET | `/lots` | any | Danh sách bãi xe |
| GET | `/lots/:id/grid` | any | Lấy bản đồ lưới (rows, cols, cells[]) để vẽ frontend |
| POST | `/lots` | admin | Tạo bãi xe mới + khởi tạo grid |

## 4. Slots (realtime)
| Method | Endpoint | Role | Mô tả |
|---|---|---|---|
| GET | `/lots/:id/slots` | any | Danh sách slot + trạng thái hiện tại (đọc từ Redis, fallback DB) |
| WS event `slot:update` | - | server → client | `{lot_id, slot_id, status}` mỗi khi trạng thái đổi |

## 5. Pathfinding (A*)
| Method | Endpoint | Role | Body/Query | Response |
|---|---|---|---|---|
| GET | `/lots/:id/pathfinding` | any | `?from_row=&from_col=&to_slot_id=` | `{path: [{row,col}, ...], distance}` |

> Backend luôn lấy trạng thái slot **mới nhất từ Redis** trước khi tìm slot đích cho A* — không dùng dữ liệu cache cũ trong request.

## 6. Bookings (điểm nóng chống trùng)
| Method | Endpoint | Role | Body | Response |
|---|---|---|---|---|
| POST | `/bookings` | customer | `{vehicle_id, slot_id}` | `201 {booking, qr_code}` hoặc `409 {error:"slot_taken"}` |
| GET | `/bookings/:id` | owner/staff/admin | - | `{booking}` |
| POST | `/bookings/:id/cancel` | owner | - | `{booking}` |

**Quy tắc bắt buộc:** `POST /bookings` phải dùng lệnh Redis atomic (`SET slot:{id} locked NX EX 300`) để kiểm tra + khóa slot trong 1 bước. Không tách "check rồi lock" thành 2 lệnh.

## 7. Check-in / Check-out
| Method | Endpoint | Role | Body | Response |
|---|---|---|---|---|
| POST | `/checkin` | staff | `{qr_code}` | `{booking, slot}` |
| POST | `/checkout` | staff | `{qr_code}` | `{booking, slot}` |

## 8. ML Prediction (proxy sang ML service)
| Method | Endpoint | Role | Query | Response |
|---|---|---|---|---|
| GET | `/lots/:id/predict-occupancy` | any | `?hour=&day_of_week=` | `{predicted_rate}` hoặc `{predicted_rate:null, note:"model unavailable"}` khi ML service chết |

> Route này ở Backend chính chỉ là **proxy** gọi sang ML service (`GET http://ml-service:8000/predict`). Backend **bắt buộc try-catch**, không để lỗi ML service làm sập cả API.

## 9. Admin / Thống kê
| Method | Endpoint | Role | Mô tả |
|---|---|---|---|
| GET | `/admin/stats/occupancy` | admin | Biểu đồ lấp đầy theo giờ/ngày |
| GET | `/admin/stats/revenue` | admin | (nếu có tính phí) |
