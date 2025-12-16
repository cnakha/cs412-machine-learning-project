
## Chicago Traffic Commute Time Forecaster

# Overview
An interactive web application that predicts commute times in Chicago using historic congestion patterns, route distance, and contextual travel conditions. The tool helps commuters visualize how traffic impacts travel time and compares a simple baseline estimate against a machine-learned prediction.

# Key Features
- Google Places Autocomplete with Chicago-biased suggestions
- Interactive Google Maps route visualization
- Baseline vs machine-learning commute time comparison
- Adjustable speed, congestion level, date, and time
- Fully responsive desktop + mobile layout

# Tech Stack
Frontend
- React (Vite)
- Tailwind CSS
- @react-google-maps/api
- Google Maps & Places APIs

Backend
- FastAPI
- Python
- Linear Regression model trained on historic Chicago traffic data


# To start backend:
cd commute-backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload

# To start frontend
npm install
npm run dev

# Members
Elizabeth Ng
Cindy Nakhammouane