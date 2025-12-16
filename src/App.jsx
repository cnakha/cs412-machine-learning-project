import { useState, useRef, useCallback } from "react";

import {
  GoogleMap,
  DirectionsRenderer,
  useLoadScript,
  Autocomplete,
} from "@react-google-maps/api";

import { MapPin, ArrowDown } from "lucide-react";

const API_BASE = "http://127.0.0.1:8000"; // FastAPI backend


function App() {

  const CHICAGO_BOUNDS = {
    north: 42.10,
    south: 41.64,
    east: -87.45,
    west: -87.95,
  };

  const mapContainerStyle = {
    width: "100%",
    height: "100%",
  };

  // Center on downtown Chicago-ish
  const defaultCenter = { lat: 41.8781, lng: -87.6298 };

  
  const libraries = ["places"];

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const chicagoLatLngBounds =
  isLoaded && window.google?.maps
    ? new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(CHICAGO_BOUNDS.south, CHICAGO_BOUNDS.west),
        new window.google.maps.LatLng(CHICAGO_BOUNDS.north, CHICAGO_BOUNDS.east)
      )
    : undefined;

  const [startLocation, setStartLocation] = useState("UIC Student Center East");
  const [endLocation, setEndLocation] = useState("The Art Institute of Chicago");
  const [currentSpeed, setCurrentSpeed] = useState(62); // mph
  const [congestionLevel, setCongestionLevel] = useState(2); // 0–4 etc.
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [time, setTime] = useState("12:00"); // HH:MM

  const [googleMinutes, setGoogleMinutes] = useState(null);
  const [routeMiles, setRouteMiles] = useState(null);

  const [directionsResult, setDirectionsResult] = useState(null);
  const [routeSummary, setRouteSummary] = useState(null);

  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const baseTime =
  routeMiles != null && currentSpeed > 0
    ? (routeMiles / currentSpeed) * 60
    : null;

  const predTime = prediction ?? null;

  const delayTime =
    predTime != null && baseTime != null
      ? Math.abs(predTime - baseTime)
      : null;


  const startAutoRef = useRef(null);
  const endAutoRef = useRef(null);

  const onStartAutoLoad = (ac) => (startAutoRef.current = ac);
  const onEndAutoLoad = (ac) => (endAutoRef.current = ac);

  const onStartPlaceChanged = () => {
    const ac = startAutoRef.current;
    if (!ac) return;

    const place = ac.getPlace();
    const value =
      place?.formatted_address ||
      place?.name ||
      "";

    if (value) setStartLocation(value);
  };

  const onEndPlaceChanged = () => {
    const ac = endAutoRef.current;
    if (!ac) return;

    const place = ac.getPlace();
    const value =
      place?.formatted_address ||
      place?.name ||
      "";

    if (value) setEndLocation(value);
  };

  // Helper for heading + cardinal direction
  function computeHeadingDeg(lat1, lng1, lat2, lng2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const toDeg = (r) => (r * 180) / Math.PI;

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lng2 - lng1);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    let θ = toDeg(Math.atan2(y, x)); // -180..+180
    if (θ < 0) θ += 360; // 0..360
    return θ;
  }

  function headingToCardinal(headingDeg) {
    if (headingDeg >= 45 && headingDeg < 135) return "E";
    if (headingDeg >= 135 && headingDeg < 225) return "S";
    if (headingDeg >= 225 && headingDeg < 315) return "W";
    return "N";
  }

  // Given minutes, format as "X hr Y mins" or "Z mins"
  const formatMinutes = (mins) => {
    if (mins == null) return "--";
    const m = Number(mins);
    const hours = Math.floor(m / 60);
    const minutes = Math.round(m % 60);
    if (hours <= 0) return `${minutes} mins`;
    return `${hours} hr${hours > 1 ? "s" : ""} ${minutes} mins`;
  };

  // Ask Google for a route / path between the locations
  const handleGetRoute = useCallback(async () => {
    if (!isLoaded || !window.google?.maps) {
      throw new Error("Google Maps not loaded yet.");
    }

    setErrorMsg("");
    setDirectionsResult(null);
    setRouteSummary(null);

    const directionsService = new window.google.maps.DirectionsService();

    return new Promise((resolve, reject) => {
      const datetimeStr = `${date}T${time}:00`;
      const departureTime = new Date(datetimeStr);

      directionsService.route(
        {
          origin: startLocation,
          destination: endLocation,
          travelMode: window.google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime,
            trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
          },
        },
        (result, status) => {
          if (status !== "OK" || !result) {
            reject(new Error("Could not get route from Google. Try different locations."));
            return;
          }

          setDirectionsResult(result);


          const route = result.routes[0];
          const leg = route.legs[0];
          const startLat = leg.start_location.lat();
          const startLng = leg.start_location.lng();
          const endLat = leg.end_location.lat();
          const endLng = leg.end_location.lng();
          const distanceMeters = (leg.distance && leg.distance.value) || 0;
          const distanceMiles = distanceMeters / 1609.34;
          const headingDeg = computeHeadingDeg(startLat, startLng, endLat, endLng);
          const dir = headingToCardinal(headingDeg);
          const googleSeconds =
            (leg.duration_in_traffic && leg.duration_in_traffic.value) ||
            (leg.duration && leg.duration.value) ||
            null;

          const googleMins = googleSeconds != null ? googleSeconds / 60 : null;
          setGoogleMinutes(googleMins);


          const summary = {
            startLat,
            startLng,
            endLat,
            endLng,
            lengthMiles: distanceMiles,
            headingDeg,
            direction: dir,
          };

          setRouteMiles(distanceMiles);
          setRouteSummary(summary);
          resolve(summary);
        }
      );
    });
  }, [isLoaded, startLocation, endLocation, date, time]);


  // Send prediction request to backend using derived features
  const handlePredict = async (summaryArg) => {
    const summary = summaryArg || routeSummary;
    if (!summary) throw new Error("Please calculate a route first.");

    const datetimeStr = `${date}T${time}:00`;

    const body = {
      direction: summary.direction,
      length: summary.lengthMiles,
      street_heading: summary.headingDeg,
      start_latitude: summary.startLat,
      start_longitude: summary.startLng,
      end_latitude: summary.endLat,
      end_longitude: summary.endLng,
      current_speed: currentSpeed,
      congestion_level: congestionLevel,
      datetime_str: datetimeStr,
    };

    const res = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const data = await res.json();
    setPrediction(data.travel_time_min);
  };


  const handleRouteThenPredict = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      setPrediction(null);

      const summary = await handleGetRoute(); 
      await handlePredict(summary);       
    } catch (e) {
      setErrorMsg(e.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };


  // Map render
  const renderMap = () => {
    if (!isLoaded) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-xs text-slate-500">
            Loading map…
          </p>
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-xs text-red-500">
            Failed to load Google Maps.
          </p>
        </div>
      );
    }

    return (
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={13}
        center={defaultCenter}
      >
        {directionsResult && (
          <DirectionsRenderer directions={directionsResult} />
        )}
      </GoogleMap>
    );
  };

  
  return (
    <main className="flex flex-1 bg-white justify-center items-center p-5">
      <div className="flex w-full min-h-vw rounded-2xl border p-10 flex-col gap-8 mt-5">
        <div className="flex flex-col lg:flex-row gap-10 w-full">
          {/* Left intro + button */}
          <div className="flex flex-col w-full lg:w-[30%] ">
            {errorMsg && (
              <p className="text-xs text-red-500 mt-1">
                {errorMsg}
              </p>
            )}

            <h1 className="text-black text-[28px] font-semibold tracking-tight">
              Chicago Traffic Commute Time Forecaster
            </h1>
            <p className="mt-8 text-[12px] text-black max-w-2xl">
              The objective of this project is to predict
              commute times based on historic Chicago congestion levels,
              distance, and other conditions. The goal is to help
              commuters visualize and understand what affects overall travel time.
            </p>
            {/* Top Control Bar */}
              <section className="w-full border border-black rounded-lg p-4 flex-1 flex-col mt-10 gap-4 h-full lg:max-w-[320px] flex">
                {/* Locations */}
                <div className="flex flex-col gap-4 flex-1">
                  <div>
                    <label className="block text-[10px] tracking-wide text-slate-500">
                      Starting Point
                    </label>
                    <div className="flex items-center w-full">
                      {/* <MapPin className="fill-red-500 h-7 w-7 stroke-white" /> */}
                      
                      <div className="flex-1">
                      {isLoaded ? (
                        <Autocomplete
                          onLoad={onStartAutoLoad}
                          onPlaceChanged={onStartPlaceChanged}
                          options={{
                            componentRestrictions: { country: "us" },
                            fields: ["formatted_address", "name", "geometry"],
                          }}
                        >
                          <input
                            type="text"
                            value={startLocation}
                            onChange={(e) => setStartLocation(e.target.value)}
                            className="w-full rounded-full border border-slate-300 px-4 m-0 py-1.5 leading-tight text-[12px] bg-white text-black"
                            placeholder="Enter origin"
                          />
                        </Autocomplete>
                      ) : (
                        <input
                          type="text"
                          value={startLocation}
                          onChange={(e) => setStartLocation(e.target.value)}
                          className="w-full rounded-full border border-slate-300 px-4 m-0 py-1.5 leading-tight text-[12px] bg-white text-black"
                          placeholder="Enter origin"
                        />
                      )}
                      </div>

                    </div>
                  </div>
                  <div className="w-full">
                    <label className="block text-[10px] tracking-wide text-slate-500">
                      Ending Point
                    </label>
                    <div className="flex items-center w-full">
                      {/* <MapPin className="fill-red-500 h-7 w-7 stroke-white" /> */}
                        
                      <div className="flex-1">
                      {isLoaded ? (
                      <Autocomplete
                        onLoad={onEndAutoLoad}
                        onPlaceChanged={onEndPlaceChanged}
                        options={{
                          bounds: chicagoLatLngBounds,    
                          strictBounds: false,         
                          componentRestrictions: { country: "us" }, 
                          fields: ["formatted_address", "name", "geometry"],
                        }}
                      >
                        <input
                          type="text"
                          value={endLocation}
                          onChange={(e) =>
                            setEndLocation(e.target.value)
                          }
                          className="flex-1 w-full rounded-full border border-slate-300 px-4 m-0 py-1.5 leading-tight text-[12px] bg-white text-black"
                          placeholder="Enter destination"
                        />
                      </Autocomplete>
                      ) : (
                        <input
                          type="text"
                          value={endLocation}
                          onChange={(e) =>
                            setEndLocation(e.target.value)
                          }
                          className="w-full rounded-full border border-slate-300 px-4 m-0 py-1.5 leading-tight text-[12px] bg-white text-black"
                          placeholder="Enter destination"
                        />
                      )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right portion of top bar: speed, congestion, date/time */}
                <div className="flex flex-col gap-4 items-start flex-1">
                  {/* Current Speed */}
                  <div className="w-full">
                    <div className="flex justify-between w-full ">
                      <p className="block text-[10px] tracking-wide text-slate-500 ">
                        Current Speed
                      </p>
                    </div>
                    <div className="flex items-center gap-3 border border-slate-300 rounded-full w-full px-2 py-1.5">
                      <span className="text-[12px] text-slate-700 mx-1 w-19">
                        {currentSpeed} mph
                      </span>

                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={currentSpeed}
                        onChange={(e) =>
                          setCurrentSpeed(Number(e.target.value))
                        }
                        className="flex-1 temp-slider mr-2"
                      />
                    </div>
                  </div>

                  {/* Congestion Level */}
                  <div className="w-full">
                    <div className="flex justify-between w-full">
                      <p className="block text-[10px] tracking-wide text-slate-500">
                        Congestion Level
                      </p>
                    </div>
                    <div className="flex items-center gap-3 border border-slate-300 rounded-full w-full px-2 py-1.5">
                      <span className="text-[12px] text-slate-700 w-8 mx-1 mr-4">
                        {congestionLevel}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={4}
                        value={congestionLevel}
                        onChange={(e) =>
                          setCongestionLevel(
                            Number(e.target.value)
                          )
                        }
                        className="flex-1 temp-slider mr-2"
                      />
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="flex gap-2 w-full">
                    <div className="w-full">
                      <div className="flex justify-between w-full">
                        <p className="block text-[10px] tracking-wide text-slate-500">
                          Time
                        </p>
                      </div>
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full border border-slate-300 bg-white text-black rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/70"
                      />
                    </div>
                    <div className="w-full">
                      <div className="flex justify-between w-full">
                        <p className="block text-[10px] tracking-wide text-slate-500">
                          Day
                        </p>
                        {/* <button className="flex pt-1 cursor-pointer">
                          <RotateCw className="h-3 w-3 stroke-slate-400" />
                        </button> */}
                      </div>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full border border-slate-300 bg-white text-black rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black/70"
                      />
                    </div>
                  </div>
                </div>
              </section>
          </div>

          {/* Right main content */}
          <div className="w-full">
            {/* Main content: Map + Right Panel */}
            <section className="flex flex-col lg:flex-row gap-10 items-stretch h-full">
              {/* Map */}
              <div className="w-full rounded-lg overflow-hidden border border-black bg-slate-200 relative h-[320px] sm:h-[420px] lg:h-full lg:flex-1">
                {renderMap()}
              </div>

              {/* Right-hand prediction card */}
              <div className="w-full lg:w-64 lg:max-w-[200px] flex flex-col gap-10">
      
              <div className="flex justify-center items-center w-full">
                <button
                  onClick={() => {
                    handleRouteThenPredict();
                  }}
                  disabled={loading}
                  className=" h-[90px] w-full p-8 rounded-md bg-black text-white text-[12px] font-medium flex flex-col justify-center items-center shadow-md hover:bg-[#1c1c1c] disabled:opacity-60 disabled:cursor-not-allowed transition"
                >
                  <span>
                    {loading
                      ? "Predicting..."
                      : "Predict Chicago Commute Time"}
                  </span>
                  {/* <span className="text-xl">↓</span> */}
                  <span><ArrowDown className=" h-7 w-7 stroke-white" /></span>
                </button>
              </div>

                <div className="rounded-md border border-black px-4 py-4 h-full flex flex-col gap-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 tracking-wide">
                      Base Commute
                    </span>
                    <span className="text-slate-900 text-sm font-medium">
                      {formatMinutes(baseTime)}
                    </span>
                  </div>

                  <div className="flex text-[30px] justify-center text-slate-400 ">
                    <span>+</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 tracking-wide">
                      Total Delay
                    </span>
                    <span className="text-slate-900 text-sm font-medium">
                      {formatMinutes(delayTime)}
                    </span>
                  </div>

                  <div className="text-[30px] flex justify-center text-slate-400">
                    <span>=</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[10px] max-w-2 text-slate-500 tracking-wide">
                      Estimated Commute Time
                    </span>
                    <span className="text-slate-900 text-sm font-semibold">
                      {formatMinutes(predTime)}
                    </span>
                  </div>

                  <div className="mt-3 pt-5 border-t border-slate-400 flex justify-between items-center text-[11px] text-slate-400">
                    <span className="text-[10px] ">Google&apos;s forecast</span>
                    <span className="font-medium text-slate-600">
                      {formatMinutes(googleMinutes)}
                    </span>
                  </div>

                  {routeSummary && (
                    <div className="mt-2 text-sm text-black space-y-2 font-semibold">
                      <div>
                        Length: {routeSummary.lengthMiles.toFixed(2)} mi
                      </div>
                      <div>
                        Heading: {routeSummary.headingDeg.toFixed(0)}° (
                        {routeSummary.direction})
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
