import math

# TEMP PLACEHOLDERS:
# Replace with real spatial logic later (e.g., using shapely/geopandas)

def find_region_for_point(lat: float, lng: float) -> int:
    """
    Map a (lat, lng) to a traffic region ID.
    For now, return a dummy region or use a very simple rule.
    Later: use shapely + region polygons.
    """
    # TODO: replace with real region lookup
    return 1  # TEMP: hard-coded region

def compute_route_distance_km(lat1, lng1, lat2, lng2, mode="driving") -> float:
    """
    Use haversine distance as a rough approximation.
    Later you can replace this with real Directions API route length.
    """
    # haversine formula
    R = 6371  # km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)

    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2*math.atan2(math.sqrt(a), math.sqrt(1-a))
    d = R*c
    return d
