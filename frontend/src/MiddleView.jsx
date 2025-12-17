
import {
  GoogleMap,
  DirectionsRenderer,
} from "@react-google-maps/api";
import Heatmap from "./Heatmap";

export default function MiddleView({isLoaded, loadError, directionsResult, view}) {
    
    const mapContainerStyle = {
        width: "100%",
        height: "100%",
    };

    const techStack = {
        ml: [
            "Python",
            "Scikit-learn",
            "Linear Regression",
            "Random Forest",
            "XGBoost",
            "Pandas",
            "NumPy",
        ],
        frontend: [
            "React",
            "JavaScript",
            "Tailwind CSS",
            "Google Maps API",
            "HeatmapLayer",
            "Figma",
        ],
        backend: [
            "FastAPI",
            "REST API",
            "Python",
        ],
    };

    const pillClass =
    "px-4 py-2 rounded-full text-xs font-medium bg-slate-200 text-slate-800";

    // Center on downtown Chicago-ish
    const defaultCenter = { lat: 41.8781, lng: -87.6298 };
    
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
    <div className="flex-1 w-full">
        {view === "map" ? (
            <div className="w-full rounded-lg overflow-hidden border border-black bg-slate-200 relative h-[320px] sm:h-[420px] lg:h-full">
                {renderMap()}
            </div>
        ) : view === "heatmap" ? (
            <div className="w-full rounded-lg overflow-hidden border border-black bg-slate-200 relative h-[320px] sm:h-[420px] lg:h-full lg:flex-1 flex items-center justify-center">
                <Heatmap
                    isLoaded={isLoaded}
                    loadError={loadError}
                    API_BASE={import.meta.env.VITE_API_BASE}
                />
            </div>
        ) : view === "model" ? (
            <div className="w-full rounded-lg overflow-hidden border border-black bg-black relative h-full sm:h-full lg:h-full lg:flex-1 flex justify-between space-x-between p-6 pb-10">
                <div className="flex flex-col gap-6">
                    <div>
                        <h2 className="text-lg font-semibold mb-2 text-white">About Our Linear Regression Model</h2>
                        <p className="text-white">
                            After experimenting with several regression models (Random Forest, XGBoost), our Linear Regression model gave the best performance with our data.
                            The dataset we selected is the Chicago Traffic Tracker – Congestion Estimates by Segments, and it’s provided by the Chicago Data Portal. This dataset contains the current estimated speed for 1257 segments that cover over 300 miles of roads across Chicago.  
                        </p>
                    </div>
                    <div className="flex gap-4 flex-wrap justify-center bg-white p-4 rounded-md">
                        <div className="flex flex-col gap-2">
                            <img src="images/LR_scatter.png" alt="Model Diagram" className="w-full h-auto max-w-[190px] rounded-md   border-slate-200"/>
                        </div>
                        <div className="flex flex-col gap-2">
                            <img src="images/LR_eh.png" alt="Model Diagram" className="w-full h-auto max-w-[180px] rounded-md  border-slate-200"/>
                        </div>
                        <div className="flex flex-col gap-2">
                            <img src="images/LR_res.png" alt="Model Diagram" className="w-full h-auto max-w-[190px] rounded-md  border-slate-200"/>
                        </div>
                        <div className="flex flex-col gap-2">
                            <img src="images/feature_Importance.png" alt="Model Diagram" className="w-full h-auto max-w-[225px] rounded-md border-slate-200"/>
                        </div>
                        <div className="flex flex-col gap-2">
                            <img src="images/learning_curve.png" alt="Model Diagram" className="w-full h-auto max-w-[245px] rounded-md border-slate-200"/>
                        </div >
                        <div className="w-[150px] h-[125px] mt-3 text-[12px] max-w-[245px] border border-black p-3 flex flex-col ">
                            <p className="font-medium mb-2 text-sm">Evaluation Metrics</p>
                            <p>MAE: 4.98s</p>
                            <p>R2: 0.956</p>
                            <p>RMSE: 8.31s</p>
                        </div>
                    </div>
                </div>
            </div>
        ) : view === "tech" ? (
       <div className="w-full rounded-lg overflow-hidden border border-black bg-black relative h-full lg:flex-1 flex p-6 pb-10">
            <div className="flex-1">
                <div className="flex flex-col w-full gap-2">
                <h2 className="text-lg font-semibold text-white">
                    How Did We Make This Project?
                </h2>
                <p className="text-white">
                    The React frontend is deployed as a static site on cloud hosting (e.g., Vercel), 
                    while a FastAPI backend serves predictions from a trained .pkl machine learning model via REST APIs (e.g., Render).
                </p>

                <div className="flex flex-col bg-white rounded-md p-4 gap-6 mt-4">
                    {/* Machine Learning */}
                    <div>
                        <h3 className="text-sm font-semibold text-black">
                            Machine Learning
                        </h3>
                        <p className="text-xs text-black mb-4 max-w-2xl">
                            We trained multiple regression models in Google Colab. The final trained model is serialized and saved as a
                            <span className="font-medium"> `.pkl` file</span> for fast reuse in production.
                        </p>
                        <div className="flex flex-wrap gap-3">
                        {techStack.ml.map((item) => (
                            <span key={item} className={pillClass}>
                            {item}
                            </span>
                        ))}
                        </div>
                    </div>

                    {/* Frontend */}
                    <div >
                        <h3 className="text-sm font-semibold text-black">
                            Frontend
                        </h3>
                        <p className="text-xs text-black mb-4 max-w-2xl">
                            The frontend is an interactive React application designed in Figma that allows users to
                            explore routes, visualize predicted commute times, and view congestion
                            patterns using Google Maps and custom heatmap overlays.
                        </p>
                        <div className="flex flex-wrap gap-3">
                        {techStack.frontend.map((item) => (
                            <span key={item} className={pillClass}>
                            {item}
                            </span>
                        ))}
                        </div>
                    </div>

                    {/* Backend */}
                    <div >
                        <h3 className="text-sm font-semibold text-black">
                            Backend
                        </h3>
                        <p className="text-xs text-black mb-4 max-w-2xl">
                            A FastAPI backend serves the trained machine learning model via REST
                            endpoints. Incoming requests are transformed into feature vectors,
                            passed into the loaded `.pkl` model, and returned as predicted commute times.
                        </p>
                        <div className="flex flex-wrap gap-3">
                        {techStack.backend.map((item) => (
                            <span key={item} className={pillClass}>
                            {item}
                            </span>
                        ))}
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>

    ) : null}
    </div>
);
}