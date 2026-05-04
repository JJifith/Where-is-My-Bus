# 🚌 Where Is My Bus — Kottayam

Real-time bus tracking web app for Kottayam routes. Drivers share their phone location → passengers see live bus positions and ETAs.

## Tech Stack
- **Frontend**: React 18 + React Router
- **Backend**: Python FastAPI
- **Database**: SQLite (file-based, no setup needed)
- **Maps**: Google Maps Embed API (free tier)

---

## Project Structure

```
whereismybus/
├── backend/
│   ├── main.py          # FastAPI app, all routes
│   ├── database.py      # SQLAlchemy + SQLite setup
│   ├── models.py        # DB tables: User, Bus, Timetable
│   ├── schemas.py       # Pydantic request/response models
│   ├── crud.py          # DB operations + seed data (Kottayam routes)
│   ├── auth_utils.py    # JWT + bcrypt
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── App.jsx              # Routes + role-based protection
    │   ├── api.js               # Axios instance with auth token
    │   ├── context/AuthContext  # Login state
    │   ├── pages/
    │   │   ├── PassengerHome    # Search buses, overview map
    │   │   ├── BusDetail        # Live map, ETA, timetable
    │   │   ├── Login            # Admin + incharge login
    │   │   ├── AdminDashboard   # Manage buses + incharges
    │   │   └── InchargeDashboard# Location sharing panel
    │   └── components/
    │       ├── Navbar.jsx
    │       └── BusMap.jsx       # Google Maps embed
    └── package.json
```

---

## Setup Instructions

### Step 1 — Backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start server
uvicorn main:uvicorn --reload --port 8000
```

The SQLite database (`whereismybus.db`) is created automatically on first run.
It seeds 5 real Kottayam bus routes + demo accounts.

### Step 2 — Google Maps API Key (optional but recommended)

1. Go to https://console.cloud.google.com/
2. Create a project → Enable **Maps Embed API**
3. Create credentials → API Key
4. Copy `.env.example` to `.env` and paste your key:

```bash
cp .env.example .env
# Edit .env → add your key
```

The app works without the key (shows a placeholder map) — add it when ready.

### Step 3 — Frontend

```bash
cd frontend
npm install
npm start
```

Open http://localhost:3000

---

## Demo Accounts

| Role     | Username      | Password   |
|----------|---------------|------------|
| Admin    | admin         | admin123   |
| Incharge | driver_rajan  | driver123  |
| Incharge | driver_suja   | driver123  |
| Incharge | driver_biju   | driver123  |

Passengers don't need an account — just open the app.

---

## Pre-loaded Kottayam Routes

| Bus No          | Route                                      |
|-----------------|--------------------------------------------|
| KL-35-A-1001   | Kottayam – Ettumanoor – Vaikom – Ernakulam |
| KL-35-B-2045   | Kottayam – Kumarakom – Changanacherry      |
| KL-35-C-3312   | Kottayam – Pala – Erattupetta              |
| KL-35-D-4501   | Kottayam – Mundakayam – Kanjirapally       |
| KL-35-E-5678   | Kottayam – Vaikom – Alappuzha              |

---

## How It Works

### Passenger Flow
1. Open the app → see all buses with live/offline status
2. Search by name, bus number, route, or stop name (e.g. "Pala", "Vaikom")
3. Click a bus → see current location on map + timetable
4. Allow location access → get ETA to your location

### Bus Incharge Flow
1. Login with credentials provided by admin
2. Select the bus you're driving today
3. Tap "Start Sharing Location" → allow GPS access
4. App sends phone GPS coordinates every 8 seconds to the server
5. Tap "Stop Sharing" at end of duty

### Admin Flow
1. Login at `/login`
2. Add/edit/delete buses with route stops
3. Manage timetables for each bus
4. Register new bus incharges
5. View dashboard stats (live bus count, etc.)

---

## API Endpoints

```
POST   /auth/login                  — login
GET    /buses                       — list all buses (public)
GET    /buses/search?q=pala         — search buses (public)
GET    /buses/{id}                  — bus detail + timetable (public)
POST   /buses                       — add bus (admin)
PUT    /buses/{id}                  — update bus (admin)
DELETE /buses/{id}                  — delete bus (admin)
GET    /buses/{id}/timetable        — get timetable (public)
POST   /buses/{id}/timetable        — add timetable entry (admin)
POST   /buses/{id}/location         — update location (incharge)
DELETE /buses/{id}/location         — stop sharing (incharge)
GET    /buses/{id}/eta?user_lat=&user_lng=  — get ETA (public)
GET    /incharges                   — list incharges (admin)
POST   /incharges                   — register incharge (admin)
DELETE /incharges/{id}              — remove incharge (admin)
GET    /admin/stats                 — dashboard stats (admin)
```

---

## ETA Calculation

```python
# Haversine formula for actual road distance approximation
distance_km = haversine(bus_lat, bus_lng, user_lat, user_lng)
avg_speed_kmh = 25  # Kottayam city average
eta_minutes = (distance_km / avg_speed_kmh) * 60
```

For more accuracy, you can upgrade this to use Google Distance Matrix API.

---

## Future Improvements
- WebSocket for true real-time updates (instead of polling)
- Google Distance Matrix API for road-based ETA
- Push notifications when bus is nearby
- Multi-trip support (same bus, multiple runs per day)
- Bus occupancy reporting by driver
