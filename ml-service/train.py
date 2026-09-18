"""
Train model dự báo tỉ lệ lấp đầy.

Chạy: python train.py
Output: model.joblib (được app.py load lên để predict)

GIAI ĐOẠN CHƯA CÓ DATA THẬT: script này tự sinh dữ liệu giả có quy luật
(giờ cao điểm sáng 7-9h, chiều 17-19h lấp đầy cao) để mày có model chạy được
ngay, làm xong luồng end-to-end rồi thay bằng data thật từ bảng
occupancy_history sau (query export ra CSV rồi load vào đây thay cho phần
sinh dữ liệu giả bên dưới).

QUAN TRỌNG: input features (hour, day_of_week) phải giữ ĐÚNG thứ tự và
cách xử lý giống hệt bên app.py lúc predict — sai chỗ này là model chạy
im lặng cho ra số vô nghĩa mà không báo lỗi gì.
"""

import numpy as np
from sklearn.ensemble import RandomForestRegressor
import joblib


def generate_fake_data(n=2000, seed=42):
    rng = np.random.default_rng(seed)
    hours = rng.integers(0, 24, n)
    days = rng.integers(0, 7, n)

    base = 0.2
    peak_morning = np.where((hours >= 7) & (hours <= 9), 0.5, 0)
    peak_evening = np.where((hours >= 17) & (hours <= 19), 0.55, 0)
    weekend_boost = np.where(days >= 5, 0.15, 0)  # cuối tuần đông hơn chút
    noise = rng.normal(0, 0.05, n)

    rate = np.clip(base + peak_morning + peak_evening + weekend_boost + noise, 0, 1)

    X = np.column_stack([hours, days])
    y = rate
    return X, y


def main():
    X, y = generate_fake_data()

    model = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42)
    model.fit(X, y)

    joblib.dump(model, "model.joblib")
    print("✅ Train xong, đã lưu model.joblib")
    print("Thử dự đoán giờ 8h thứ 2 (peak sáng, ngày thường):", model.predict([[8, 0]]))
    print("Thử dự đoán giờ 2h thứ 2 (vắng):", model.predict([[2, 0]]))


if __name__ == "__main__":
    main()
