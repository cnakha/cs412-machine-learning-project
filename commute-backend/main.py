from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import joblib
import datetime as dt
import math
from pydantic import BaseModel
from typing import List



app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://cs412-machine-learning-project.vercel.app/", 
    ],  # frontend dev server
    allow_credentials=True,
    allow_methods=["*"],       # allow POST, GET, OPTIONS, etc.
    allow_headers=["*"],       # allow Content-Type, Authorization, etc.
)


model = joblib.load("model/travel_time_model.pkl")

DIRECTION_MAP = {
    "N": 0,
    "S": 1,
    "E": 2,
    "W": 3,
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
    dt_obj = dt.datetime.fromisoformat(req.datetime_str)
    hour_of_day = dt_obj.hour          # 0–23
    day_of_week = dt_obj.weekday()     # 0=Mon
    month = dt_obj.month               # 1–12

    dir_val = DIRECTION_MAP.get(req.direction.upper())
    if dir_val is None:
        dir_val = 0

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


def haversine_miles(lat1, lon1, lat2, lon2):
    # Earth radius in miles
    R = 3958.7613
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def bearing_deg(lat1, lon1, lat2, lon2):
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)

    y = math.sin(dlambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    theta = math.degrees(math.atan2(y, x))
    return (theta + 360) % 360

def bearing_to_cardinal_4(b):
    if 45 <= b < 135:
        return "E"
    if 135 <= b < 225:
        return "S"
    if 225 <= b < 315:
        return "W"
    return "N"


class HeatPoint(BaseModel):
    lat: float
    lng: float

class HeatmapRequest(BaseModel):
    points: List[HeatPoint]

    current_speed: float
    congestion_level: float
    datetime_str: str

    dest_lat: float | None = None
    dest_lng: float | None = None

class HeatmapPointOut(BaseModel):
    lat: float
    lng: float
    weight: float   # delay intensity (minutes)

class HeatmapResponse(BaseModel):
    data: List[HeatmapPointOut]


@app.post("/heatmap", response_model=HeatmapResponse)
def heatmap(req: HeatmapRequest):
    # Fixed destination: Chicago Loop 
    DEST_LAT = req.dest_lat if req.dest_lat is not None else 41.8781
    DEST_LNG = req.dest_lng if req.dest_lng is not None else -87.6298

    # time features
    dt_obj = dt.datetime.fromisoformat(req.datetime_str)
    hour_of_day = dt_obj.hour
    day_of_week = dt_obj.weekday()
    month = dt_obj.month

    # Build all feature rows, then predict in one batch 
    X = []
    meta = []  # store lat/lng and baseline so we can compute delay after predicting

    for p in req.points:
        length_miles = haversine_miles(p.lat, p.lng, DEST_LAT, DEST_LNG)
        b = bearing_deg(p.lat, p.lng, DEST_LAT, DEST_LNG)
        direction = bearing_to_cardinal_4(b)

        dir_val = DIRECTION_MAP.get(direction, 0)

        # baseline minutes = distance / speed * 60
        base_min = (length_miles / req.current_speed) * 60 if req.current_speed > 0 else 0.0

        X.append([
            dir_val,             # DIRECTION
            length_miles,        # LENGTH
            b,                   # STREET_HEADING
            p.lng,               # START_LONGITUDE
            p.lat,               # START_LATITUDE
            DEST_LNG,            # END_LONGITUDE
            DEST_LAT,            # END_LATITUDE
            req.current_speed,   # CURRENT_SPEED
            req.congestion_level,# CONGESTION_LEVEL
            hour_of_day,         # HOUR_OF_DAY
            day_of_week,         # DAY_OF_WEEK
            month,               # MONTH
        ])

        meta.append((p.lat, p.lng, base_min))

    preds = model.predict(X)

    out = []
    for (lat, lng, base_min), pred_min in zip(meta, preds):
        delay = abs(float(pred_min) - float(base_min))
        out.append(HeatmapPointOut(lat=lat, lng=lng, weight=delay))

    return HeatmapResponse(data=out)
