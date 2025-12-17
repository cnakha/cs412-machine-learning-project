import { GoogleMap } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState } from "react";

const CHICAGO_BOUNDS_CORE = {
  north: 42.03,
  south: 41.78,
  east: -87.52,
  west: -87.78,
};

const gradient = [
  "rgba(0, 255, 255, 0)",
  "rgba(0, 255, 255, 1)",
  "rgba(0, 191, 255, 1)",
  "rgba(0, 255, 0, 1)",
  "rgba(255, 255, 0, 1)",
  "rgba(255, 128, 0, 1)",
  "rgba(255, 0, 0, 1)",
];

const defaultCenter = { lat: 41.8781, lng: -87.6298 };

// Generate grid of points over Chicago
function generateGrid(bounds, step = 0.015) {
  const pts = [];
  for (let lat = bounds.south; lat <= bounds.north; lat += step) {
    for (let lng = bounds.west; lng <= bounds.east; lng += step) {
      pts.push({ lat, lng });
    }
  }
  return pts;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}


export default function Heatmap({ isLoaded, loadError, API_BASE }) {
//   const mapRef = useRef(null);
    const [map, setMap] = useState(null);

    const onMapLoad = (m) => {
    setMap(m);
    };

  const heatmapRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const grid = useMemo(() => generateGrid(CHICAGO_BOUNDS_CORE, 0.006), []);

  const mapContainerStyle = { width: "100%", height: "100%" };

//   const onMapLoad = (map) => {
//     mapRef.current = map;
//   };

  useEffect(() => {
      if (!isLoaded || !window.google?.maps?.visualization || !map) return;

    const runHeatmap = async () => {
      setLoading(true);
      setError("");

      try {
        const datetime_str = new Date().toISOString().slice(0, 16) + ":00";

        const res = await fetch(`${API_BASE}/heatmap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            points: grid,
            current_speed: 30,
            congestion_level: 2,
            datetime_str,
          }),
        });

        if (!res.ok) throw new Error("Failed to load heatmap");

        const json = await res.json();
        const rawWeights = (json.data || []).map((p) => Number(p.weight) || 0);
        const p05 = percentile(rawWeights, 5);
        const p95 = percentile(rawWeights, 95);
        const denom = Math.max(1e-6, p95 - p05);

        // Map weights into 0..1 then stretch to 0..50
        const heatData = (json.data || []).map((p) => {
        const w = Number(p.weight) || 0;

        // normalize and clamp
        let t = (w - p05) / Math.max(1e-6, p95 - p05);
        t = Math.max(0.05, Math.min(1, t)); // 0.05 floor
        t = Math.pow(t, 0.35); 


        return {
            location: new window.google.maps.LatLng(p.lat, p.lng),
            weight: t * 50,
        };
        });
        const scaledWeights = heatData.map((x) => x.weight);
        const maxScaled = scaledWeights.length ? Math.max(...scaledWeights) : 50;

        console.log("raw weight range:", {
        min: Math.min(...rawWeights),
        max: Math.max(...rawWeights),
        p05,
        p95,
        });


        const weights = (json.data || []).map(p => p.weight);
        const maxW = weights.length ? Math.max(...weights) : 0;
        const minW = weights.length ? Math.min(...weights) : 0;
        console.log("weight range:", { minW, maxW });


        if (!heatmapRef.current) {
            heatmapRef.current = new window.google.maps.visualization.HeatmapLayer({
                data: heatData,
                radius: 28,
                dissipating: true,
                opacity: 0.85,
                maxIntensity: maxScaled,
                gradient,
            });
            heatmapRef.current.setMap(map);
            } else {
            heatmapRef.current.setData(heatData);
            heatmapRef.current.set("maxIntensity", maxScaled);
            heatmapRef.current.set("gradient", gradient);
            }


      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    runHeatmap();
  }, [isLoaded, map, grid, API_BASE]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
        Loading…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-red-500">
        Failed to load Google Maps.
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
        <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={13}
        onLoad={onMapLoad}
        options={{
            streetViewControl: false,
            mapTypeControl: false,
        }}
        />

        {(loading || error) && (
        <div className="absolute top-3 left-3 bg-white border border-black rounded-md px-3 py-2 text-xs">
            {loading ? "Generating heatmap…" : error}
        </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/95 border border-black rounded-md px-3 py-3 flex items-center gap-3">
        <div className="flex flex-col items-center justify-between h-28">
            <span className="text-[10px] text-slate-700 leading-none">High</span>

            <div
            className="w-3 h-20 rounded-sm border border-slate-300"
            style={{
                background:
                "linear-gradient(to top, rgba(0,0,255,0.0), rgba(0,255,255,0.8), rgba(0,255,0,0.9), rgba(255,255,0,0.95), rgba(255,0,0,1))",
            }}
            />

            <span className="text-[10px] text-slate-700 leading-none">Low</span>
        </div>

        <div className="flex flex-col gap-1">
            <p className="text-[11px] font-semibold text-black">Delay intensity</p>
            <p className="text-[10px] text-slate-600 max-w-[160px] leading-snug">
            Warmer colors indicate higher predicted delay (minutes) under standard
            conditions.
            </p>
        </div>
        </div>
    </div>
    );
}
