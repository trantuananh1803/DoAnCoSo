-- ============================================
-- SCHEMA: Hệ thống quản lý bãi đỗ xe thông minh
-- Database: PostgreSQL
-- ============================================

CREATE TYPE user_role AS ENUM ('customer', 'staff', 'admin');
CREATE TYPE slot_status AS ENUM ('empty', 'reserved', 'occupied', 'blocked');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'expired');
CREATE TYPE cell_type AS ENUM ('path', 'slot', 'obstacle', 'gate');

-- ---------- USERS ----------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- VEHICLES ----------
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    license_plate VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(30) DEFAULT 'car', -- car / motorbike
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- PARKING LOTS ----------
CREATE TABLE parking_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    address VARCHAR(255),
    grid_rows INT NOT NULL,      -- số hàng của lưới (map)
    grid_cols INT NOT NULL,      -- số cột của lưới
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- GRID CELLS (bản đồ lưới cho A*) ----------
-- Mỗi ô trong lưới của 1 bãi xe: type = path / slot / obstacle / gate
CREATE TABLE grid_cells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id UUID REFERENCES parking_lots(id) ON DELETE CASCADE,
    row_idx INT NOT NULL,
    col_idx INT NOT NULL,
    cell_type cell_type NOT NULL DEFAULT 'path',
    walkable BOOLEAN NOT NULL DEFAULT TRUE, -- false nếu obstacle
    UNIQUE(lot_id, row_idx, col_idx)
);

-- ---------- PARKING SLOTS ----------
-- Mỗi slot gắn với đúng 1 grid_cell (type = 'slot')
CREATE TABLE parking_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id UUID REFERENCES parking_lots(id) ON DELETE CASCADE,
    grid_cell_id UUID REFERENCES grid_cells(id) ON DELETE CASCADE,
    slot_code VARCHAR(20) NOT NULL,       -- ví dụ: A01, B12
    status slot_status NOT NULL DEFAULT 'empty',
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(lot_id, slot_code)
);

-- ---------- BOOKINGS ----------
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    vehicle_id UUID REFERENCES vehicles(id),
    slot_id UUID REFERENCES parking_slots(id),
    qr_code VARCHAR(255) UNIQUE NOT NULL,
    status booking_status NOT NULL DEFAULT 'pending',
    reserved_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,        -- hết hạn nếu không check-in kịp
    checked_in_at TIMESTAMPTZ,
    checked_out_at TIMESTAMPTZ
);

-- ---------- CHECKIN / CHECKOUT LOGS ----------
CREATE TABLE checkin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id),
    staff_id UUID REFERENCES users(id),
    action VARCHAR(20) NOT NULL, -- 'check_in' / 'check_out'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- OCCUPANCY HISTORY (dữ liệu train cho ML) ----------
-- Snapshot tỉ lệ lấp đầy theo từng khung giờ, dùng để train + đánh giá model dự báo
CREATE TABLE occupancy_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id UUID REFERENCES parking_lots(id),
    snapshot_time TIMESTAMPTZ NOT NULL,
    day_of_week SMALLINT NOT NULL,   -- 0-6, tách sẵn để train nhanh, khỏi tính lại lúc predict
    hour_of_day SMALLINT NOT NULL,   -- 0-23
    total_slots INT NOT NULL,
    occupied_slots INT NOT NULL,
    occupancy_rate NUMERIC(5,2) NOT NULL -- occupied/total, cache sẵn
);

-- Index phục vụ truy vấn nóng nhất: check slot trống + query lịch sử theo giờ
CREATE INDEX idx_slots_lot_status ON parking_slots(lot_id, status);
CREATE INDEX idx_occupancy_lot_time ON occupancy_history(lot_id, day_of_week, hour_of_day);
CREATE INDEX idx_bookings_status ON bookings(status);
