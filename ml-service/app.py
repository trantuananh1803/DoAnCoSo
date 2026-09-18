"""
ML service — dự báo tỉ lệ lấp đầy bãi xe theo khung giờ.
Chạy độc lập với backend chính, để backend chính gọi HTTP sang.

Cài đặt:
    pip install fastapi uvicorn scikit-learn joblib pandas
Chạy:
    uvicorn app:app --reload --port 8000
"""

from fastapi import FastAPI, Query
from pydantic import BaseModel
import joblib
import os
import numpy as np

app = FastAPI(title="Parking Occupancy Prediction Service")

MODEL_PATH = "model.joblib"
_model = None


def load_model():
    global _model
    if _model is None and os.path.exists(MODEL_PATH):
        _model = joblib.load(MODEL_PATH)
    return _model


class PredictResponse(BaseModel):
    lot_id: str
    hour: int
    day_of_week: int
    predicted_rate: float | None
    note: str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": load_model() is not None}


@app.get("/predict", response_model=PredictResponse)
def predict(
    lot_id: str = Query(...),
    hour: int = Query(..., ge=0, le=23),
    day_of_week: int = Query(..., ge=0, le=6),
):
    model = load_model()

    if model is None:
        # QUAN TRỌNG: không throw lỗi 500 — trả về None có kiểm soát để
        # backend chính vẫn hoạt động bình thường khi model chưa train xong.
        return PredictResponse(
            lot_id=lot_id,
            hour=hour,
            day_of_week=day_of_week,
            predicted_rate=None,
            note="Model chưa được train, dùng train.py để tạo model.joblib trước.",
        )

    # Input phải cùng format/thứ tự cột như lúc train (xem train.py)
    X = np.array([[hour, day_of_week]])
    predicted = model.predict(X)[0]
    predicted = float(np.clip(predicted, 0, 1))  # tỉ lệ lấp đầy trong khoảng [0,1]

    return PredictResponse(
        lot_id=lot_id, hour=hour, day_of_week=day_of_week, predicted_rate=round(predicted, 3)
    )
