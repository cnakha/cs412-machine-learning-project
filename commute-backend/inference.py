import joblib
import pandas as pd
from datetime import datetime
from utils.geo import find_region_for_point, compute_route_distance_km

# ---------- 1. Load model + lookup tables ----------
class FakeModel:
    def predict(self, X):
        # X will be a list of lists, e.g. [[feature1, feature2, ...]]

        # You can return ANY number you want for now.
        # Example: distance * 2 + random noise
        import random
        distance = X[0][0] if len(X[0]) > 0 else 5  # first feature
        return [distance * 2 + random.uniform(-3, 3)]


def load_resources():
    """
    Called once when FastAPI starts.
    Returns a dict with the model, feature names, and lookup tables.
    """
    # model = joblib.load("model/commute_model.pkl")
    # feature_cols = joblib.load("model/feature_columns.pkl")

     # instead of loading real model:
    model = FakeModel()

    feature_cols = [
        "route_distance_km",
        "origin_region_id",
        "destination_region_id",
        "mode",
        "mean_speed",
        "mean_congestion",
        "temp_f",
        "rain_intensity",
        "humidity",
        "crash_count_60min",
        "hour",
        "day_of_week",
        "is_weekend",
        "month",
        "season"
    ]

    # adjust filenames if yours differ
    # congestion = pd.read_parquet("data/congestion.parquet")
    # weather = pd.read_parquet("data/weather.parquet")
    # crashes = pd.read_parquet("data/crashes.parquet")

    # load fake / empty tables so the code doesn’t break
    congestion = pd.DataFrame()
    weather = pd.DataFrame()
    crashes = pd.DataFrame()

    # set indices or preprocessing useful for fast lookup
    # Example: index by (region_id, ts5)
    if {"region_id", "ts5"}.issubset(congestion.columns):
        congestion = congestion.set_index(["region_id", "ts5"]).sort_index()
    if "ts5" in weather.columns:
        weather = weather.set_index("ts5").sort_index()
    if {"region_id", "ts5"}.issubset(crashes.columns):
        crashes = crashes.set_index(["region_id", "ts5"]).sort_index()

    return {
        "model": model,
        "feature_cols": feature_cols,
        "congestion": congestion,
        "weather": weather,
        "crashes": crashes,
    }

# ---------- 2. Helpers ----------

def floor_to_5min(dt: datetime) -> pd.Timestamp:
    ts = pd.to_datetime(dt)
    # assume input is already local Chicago time or includes tz info
    ts = ts.floor("5min")
    return ts

def safe_get_congestion(cong_df, region_id, ts5):
    try:
        row = cong_df.loc[(region_id, ts5)]
    except KeyError:
        # fallback: try same region, closest previous record
        try:
            row = cong_df.loc[region_id].loc[:ts5].iloc[-1]
        except Exception:
            return None
    return row

def safe_get_weather(weather_df, ts5):
    # closest record at or before ts5
    try:
        return weather_df.loc[:ts5].iloc[-1]
    except Exception:
        return None

def safe_get_crashes(crash_df, region_id, ts5):
    # you might have prepared aggregated crash counts already;
    # if not, just return 0 as a placeholder.
    try:
        row = crash_df.loc[(region_id, ts5)]
        return row.get("crash_count_60min", 0)
    except Exception:
        return 0

# ---------- 3. Feature builder + prediction ----------

def build_feature_row(req, resources):
    """
    Turn the request + lookup tables into a feature dict for the model.
    """
    cong_df = resources["congestion"]
    weather_df = resources["weather"]
    crash_df = resources["crashes"]

    # 1) Parse datetime
    dt5 = floor_to_5min(req.datetime)

    # 2) Map lat/lng to traffic regions
    origin_region = find_region_for_point(req.origin_lat, req.origin_lng)
    dest_region = find_region_for_point(req.dest_lat, req.dest_lng)

    # 3) Route distance (km)
    distance_km = compute_route_distance_km(
        req.origin_lat, req.origin_lng,
        req.dest_lat, req.dest_lng,
        mode=req.mode
    )

    # 4) Look up congestion for both regions
    cong_o = safe_get_congestion(cong_df, origin_region, dt5)
    cong_d = safe_get_congestion(cong_df, dest_region, dt5)

    # simple averages; adjust to match your feature engineering
    if cong_o is not None and cong_d is not None:
        mean_speed = float((cong_o["speed_mean"] + cong_d["speed_mean"]) / 2)
        mean_congestion = float((cong_o["cong_mean"] + cong_d["cong_mean"]) / 2)
    else:
        # fallback defaults if not found
        mean_speed = 30.0
        mean_congestion = 0.5

    # 5) Weather
    w = safe_get_weather(weather_df, dt5)
    if w is not None:
        temp_f = float(w.get("temp_f", 50.0))
        rain_intensity = float(w.get("rain_intensity", 0.0))
        humidity = float(w.get("humidity", 0.5))
    else:
        temp_f, rain_intensity, humidity = 50.0, 0.0, 0.5

    # allow user override from UI (optional)
    if req.temp_f is not None:
        temp_f = req.temp_f
    if req.rain_intensity is not None:
        rain_intensity = req.rain_intensity
    if req.humidity is not None:
        humidity = req.humidity

    # 6) Crash feature (region-level)
    crash_count_60min = safe_get_crashes(crash_df, origin_region, dt5)

    # 7) Temporal features
    hour = dt5.hour
    dow = dt5.dayofweek
    is_weekend = 1 if dow >= 5 else 0
    month = dt5.month
    # simple season mapping
    if month in (12,1,2):
        season = 0
    elif month in (3,4,5):
        season = 1
    elif month in (6,7,8):
        season = 2
    else:
        season = 3

    features = {
        "route_distance_km": distance_km,
        "origin_region_id": origin_region,
        "destination_region_id": dest_region,
        "mode": req.mode,

        "mean_speed": mean_speed,
        "mean_congestion": mean_congestion,

        "temp_f": temp_f,
        "rain_intensity": rain_intensity,
        "humidity": humidity,

        "crash_count_60min": crash_count_60min,

        "hour": hour,
        "day_of_week": dow,
        "is_weekend": is_weekend,
        "month": month,
        "season": season,
    }

    return features

def apply_forecast_type(features: dict, forecast_type: str):
    """
    Zero out or neutralize certain feature groups depending on the user's selection.
    This uses simple defaults; adjust to match your data.
    """
    if forecast_type == "congestion":
        # keep congestion; neutralize weather & accidents
        features["temp_f"] = 50.0
        features["rain_intensity"] = 0.0
        features["humidity"] = 0.5
        features["crash_count_60min"] = 0

    elif forecast_type == "weather":
        # keep weather; neutralize congestion & accidents
        features["mean_speed"] = 30.0
        features["mean_congestion"] = 0.5
        features["crash_count_60min"] = 0

    elif forecast_type == "accidents":
        # keep crash_count; neutralize weather; keep average congestion
        features["temp_f"] = 50.0
        features["rain_intensity"] = 0.0
        features["humidity"] = 0.5
        # keep mean_speed / mean_congestion as-is

    # "overall" → do nothing
    return features

def compute_freeflow_time(distance_km: float, mode: str) -> float:
    """
    Rough base time without extra delay, for UI breakdown.
    Adjust speeds per mode as you like.
    """
    if mode == "walking":
        speed_kmh = 5.0
    elif mode == "cycling":
        speed_kmh = 15.0
    elif mode == "transit":
        speed_kmh = 25.0   # rough city average
    else:  # driving
        speed_kmh = 45.0

    if speed_kmh <= 0:
        return 0.0
    return (distance_km / speed_kmh) * 60.0  # minutes

def predict_commute(req, resources):
    model = resources["model"]
    feature_cols = resources["feature_cols"]

    feats = build_feature_row(req, resources)
    feats = apply_forecast_type(feats, req.forecast_type)

    # Convert dict → aligned feature vector
    row = [feats.get(col, 0) for col in feature_cols]
    pred_minutes = float(model.predict([row])[0])

    base_time = compute_freeflow_time(
        distance_km=feats["route_distance_km"],
        mode=req.mode
    )
    delay = max(pred_minutes - base_time, 0.0)

    return {
        "pred_time_min": pred_minutes,
        "base_time_min": base_time,
        "delay_min": delay
    }
