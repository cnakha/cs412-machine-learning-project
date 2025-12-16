# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import joblib
import datetime as dt
import math
from pydantic import BaseModel


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],  # frontend dev server
    allow_credentials=True,
    allow_methods=["*"],       # allow POST, GET, OPTIONS, etc.
    allow_headers=["*"],       # allow Content-Type, Authorization, etc.
)


model = joblib.load("model/travel_time_model.pkl")

# 📝 IMPORTANT: Make this mapping match how you encoded DIRECTION in df
DIRECTION_MAP = {
    "N": 0,
    "S": 1,
    "E": 2,
    "W": 3,
    # add "NB", "SB", etc if you used them
}

class PredictRequest(BaseModel):
    direction: str           # 'N', 'S', 'E', 'W', etc.
    length: float            # same unit as in your df
    street_heading: float    # e.g., 0–360 degrees
    start_latitude: float
    start_longitude: float
    end_latitude: float
    end_longitude: float
    current_speed: float     # mph or whatever you used
    congestion_level: float  # numeric 0–4 etc.
    datetime_str: str        # "YYYY-MM-DDTHH:MM:SS"

class PredictResponse(BaseModel):
    travel_time_min: float

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    # 1. time features
    dt_obj = dt.datetime.fromisoformat(req.datetime_str)
    hour_of_day = dt_obj.hour          # 0–23
    day_of_week = dt_obj.weekday()     # 0=Mon
    month = dt_obj.month               # 1–12

    # 2. direction encoding
    dir_val = DIRECTION_MAP.get(req.direction.upper())
    if dir_val is None:
        # fallback or raise error; here we'll just use 0
        dir_val = 0

    # 3. Build feature vector in EXACT same order as training
    X = [[
        dir_val,                # DIRECTION
        req.length,             # LENGTH
        req.street_heading,     # STREET_HEADING
        req.start_longitude,    # START_LONGITUDE
        req.start_latitude,     # START_LATITUDE
        req.end_longitude,      # END_LONGITUDE
        req.end_latitude,       # END_LATITUDE
        req.current_speed,      # CURRENT_SPEED
        req.congestion_level,   # CONGESTION_LEVEL
        hour_of_day,            # HOUR_OF_DAY
        day_of_week,            # DAY_OF_WEEK
        month,                  # MONTH
    ]]

    y_pred = model.predict(X)[0]
    return PredictResponse(travel_time_min=float(y_pred))
