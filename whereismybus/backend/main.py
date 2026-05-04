from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from typing import Optional
import math, json, os, httpx
from database import SessionLocal, engine, Base
import models, schemas, auth_utils, crud

Base.metadata.create_all(bind=engine)

GOOGLE_MAPS_KEY = os.environ.get("GOOGLE_MAPS_KEY", "")

@asynccontextmanager
async def lifespan(app):
    db = SessionLocal()
    crud.seed_data(db)
    db.close()
    yield

app = FastAPI(title="Where Is My Bus - Kottayam", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:3000",],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = auth_utils.verify_token(credentials.credentials, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

def require_admin(current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return current_user

def require_incharge(current_user=Depends(get_current_user)):
    if current_user.role not in ["admin", "incharge"]:
        raise HTTPException(status_code=403, detail="Bus incharge only")
    return current_user

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

# ── Auth ──────────────────────────────────────────────────────────────────────
@app.post("/auth/login", response_model=schemas.LoginResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = auth_utils.create_token(user.id)
    return {"token": token, "user": user}

# ── Buses ─────────────────────────────────────────────────────────────────────
@app.get("/buses", response_model=list[schemas.BusOut])
def list_buses(db: Session = Depends(get_db)):
    return crud.get_all_buses(db)

@app.get("/buses/search", response_model=list[schemas.BusOut])
def search_buses(q: Optional[str] = None, stop: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.search_buses(db, q, stop)

@app.get("/buses/{bus_id}", response_model=schemas.BusDetail)
def get_bus(bus_id: int, db: Session = Depends(get_db)):
    bus = crud.get_bus(db, bus_id)
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    return bus

@app.post("/buses", response_model=schemas.BusOut)
def create_bus(payload: schemas.BusCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    return crud.create_bus(db, payload)

@app.put("/buses/{bus_id}", response_model=schemas.BusOut)
def update_bus(bus_id: int, payload: schemas.BusCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    bus = crud.update_bus(db, bus_id, payload)
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    return bus

@app.delete("/buses/{bus_id}")
def delete_bus(bus_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    crud.delete_bus(db, bus_id)
    return {"ok": True}

# ── All stops autocomplete ─────────────────────────────────────────────────────
@app.get("/stops/autocomplete")
def autocomplete_stops(q: str = "", db: Session = Depends(get_db)):
    buses = crud.get_all_buses(db)
    all_stops = set()
    for bus in buses:
        try:
            stops = json.loads(bus.route_stops)
        except:
            stops = [s.strip() for s in bus.route_stops.split(",")]
        for stop in stops:
            all_stops.add(stop.strip())
    if q:
        term = q.lower()
        matches = [s for s in all_stops if term in s.lower()]
    else:
        matches = list(all_stops)
    return sorted(matches)

# ── Validate stop via Places API ───────────────────────────────────────────────
@app.get("/stops/validate")
async def validate_stop(name: str):
    if not GOOGLE_MAPS_KEY:
        return {"valid": True, "message": "Validation skipped (no API key)", "place": name}
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
            params={
                "input": f"{name}, Kottayam, Kerala",
                "inputtype": "textquery",
                "fields": "name,formatted_address,geometry",
                "locationbias": "circle:50000@9.5916,76.5222",
                "key": GOOGLE_MAPS_KEY,
            }
        )
        data = r.json()
        candidates = data.get("candidates", [])
        if candidates:
            place = candidates[0]
            return {
                "valid": True,
                "place": place.get("name"),
                "address": place.get("formatted_address"),
                "lat": place.get("geometry", {}).get("location", {}).get("lat"),
                "lng": place.get("geometry", {}).get("location", {}).get("lng"),
            }
        return {"valid": False, "message": f"Could not verify '{name}' as a real place in Kottayam"}

# ── Directions / route path ────────────────────────────────────────────────────
@app.get("/buses/{bus_id}/directions")
async def get_directions(bus_id: int, db: Session = Depends(get_db)):
    bus = crud.get_bus(db, bus_id)
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    if not GOOGLE_MAPS_KEY:
        return {"polyline": None, "message": "No API key configured"}
    try:
        stops = json.loads(bus.route_stops)
    except:
        stops = [s.strip() for s in bus.route_stops.split(",")]
    if len(stops) < 2:
        return {"polyline": None}
    origin = f"{stops[0]}, Kottayam, Kerala"
    destination = f"{stops[-1]}, Kerala"
    waypoints = "|".join([f"{s}, Kerala" for s in stops[1:-1]]) if len(stops) > 2 else ""
    async with httpx.AsyncClient() as client:
        params = {
            "origin": origin,
            "destination": destination,
            "mode": "driving",
            "key": GOOGLE_MAPS_KEY,
        }
        if waypoints:
            params["waypoints"] = waypoints
        r = await client.get("https://maps.googleapis.com/maps/api/directions/json", params=params)
        data = r.json()
        if data.get("status") == "OK":
            poly = data["routes"][0]["overview_polyline"]["points"]
            legs = data["routes"][0]["legs"]
            stop_etas = []
            cumulative_mins = 0
            for i, leg in enumerate(legs):
                cumulative_mins += leg["duration"]["value"] / 60
                stop_etas.append({
                    "stop": stops[i + 1],
                    "minutes_from_start": round(cumulative_mins),
                    "distance_km": round(leg["distance"]["value"] / 1000, 1)
                })
            return {"polyline": poly, "stop_etas": stop_etas}
        return {"polyline": None, "error": data.get("status")}

# ── Timetable ─────────────────────────────────────────────────────────────────
@app.get("/buses/{bus_id}/timetable", response_model=list[schemas.TimetableOut])
def get_timetable(bus_id: int, db: Session = Depends(get_db)):
    return crud.get_timetable(db, bus_id)

@app.post("/buses/{bus_id}/timetable", response_model=schemas.TimetableOut)
def add_timetable(bus_id: int, payload: schemas.TimetableCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    return crud.add_timetable(db, bus_id, payload)

@app.delete("/timetable/{tt_id}")
def delete_timetable(tt_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    crud.delete_timetable(db, tt_id)
    return {"ok": True}

# ── Incharges ──────────────────────────────────────────────────────────────────
@app.get("/incharges", response_model=list[schemas.UserOut])
def list_incharges(db: Session = Depends(get_db), _=Depends(require_admin)):
    return crud.get_incharges(db)

@app.post("/incharges", response_model=schemas.UserOut)
def create_incharge(payload: schemas.CreateIncharge, db: Session = Depends(get_db), _=Depends(require_admin)):
    existing = crud.get_user_by_username(db, payload.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    return crud.create_incharge(db, payload)

@app.delete("/incharges/{user_id}")
def delete_incharge(user_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    crud.delete_user(db, user_id)
    return {"ok": True}

# ── Location ───────────────────────────────────────────────────────────────────
@app.post("/buses/{bus_id}/location")
def update_location(bus_id: int, payload: schemas.LocationUpdate, db: Session = Depends(get_db), current_user=Depends(require_incharge)):
    crud.update_bus_location(db, bus_id, payload.lat, payload.lng, current_user.id)
    return {"ok": True}

@app.delete("/buses/{bus_id}/location")
def stop_sharing(bus_id: int, db: Session = Depends(get_db), _=Depends(require_incharge)):
    crud.clear_bus_location(db, bus_id)
    return {"ok": True}

# ── ETA with per-stop breakdown ───────────────────────────────────────────────
@app.get("/buses/{bus_id}/eta")
def get_eta(bus_id: int, user_lat: float, user_lng: float, db: Session = Depends(get_db)):
    bus = crud.get_bus(db, bus_id)
    if not bus or bus.current_lat is None:
        raise HTTPException(status_code=404, detail="Bus location not available")
    try:
        stops = json.loads(bus.route_stops)
    except:
        stops = [s.strip() for s in bus.route_stops.split(",")]
    timetable = crud.get_timetable(db, bus_id)
    tt_map = {t.stop_name: t.arrival_time for t in timetable}

    dist_km = haversine(bus.current_lat, bus.current_lng, user_lat, user_lng)
    avg_speed_kmh = 25
    eta_minutes = round((dist_km / avg_speed_kmh) * 60)

    # Find which segment bus is on
    from stop_utils import find_bus_segment, get_stop_coords
    seg_idx, between_label = find_bus_segment(stops, bus.current_lat, bus.current_lng)

    # Per-stop ETAs for upcoming stops
    stop_etas = []
    for i, stop in enumerate(stops):
        if i <= seg_idx:
            continue  # already passed
        coords = get_stop_coords(stop)
        if coords:
            d = haversine(bus.current_lat, bus.current_lng, coords[0], coords[1])
            mins = round((d / avg_speed_kmh) * 60)
            stop_etas.append({
                "stop": stop,
                "stop_index": i,
                "eta_minutes": mins,
                "scheduled": tt_map.get(stop),
            })

    return {
        "bus_id": bus_id,
        "distance_km": round(dist_km, 2),
        "eta_minutes": eta_minutes,
        "bus_lat": bus.current_lat,
        "bus_lng": bus.current_lng,
        "last_updated": bus.location_updated_at,
        "current_segment": between_label,
        "segment_index": seg_idx,
        "stop_etas": stop_etas,
    }

# ── Admin stats ────────────────────────────────────────────────────────────────
@app.get("/admin/stats")
def admin_stats(db: Session = Depends(get_db), _=Depends(require_admin)):
    return crud.get_stats(db)

# ── Validate stop is between two endpoints ─────────────────────────────────────
@app.get("/stops/validate-between")
async def validate_stop_between(stop: str, origin: str, destination: str):
    """Check if a stop is geographically between origin and destination"""
    from stop_utils import get_stop_coords, haversine
    
    origin_coords = get_stop_coords(origin)
    dest_coords = get_stop_coords(destination)
    stop_coords = get_stop_coords(stop)
    
    if not origin_coords or not dest_coords:
        # Try Places API if coords not in local dict
        return {"valid": True, "message": "Could not verify geographically, but stop name looks valid", "skipped": True}
    
    if not stop_coords:
        # Stop not in our coords dict — try Places API validation
        if GOOGLE_MAPS_KEY:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
                    params={"input": f"{stop}, Kottayam, Kerala", "inputtype": "textquery",
                            "fields": "geometry,name", "key": GOOGLE_MAPS_KEY}
                )
                data = r.json()
                candidates = data.get("candidates", [])
                if candidates:
                    loc = candidates[0].get("geometry", {}).get("location", {})
                    stop_coords = (loc.get("lat", 0), loc.get("lng", 0))
                else:
                    return {"valid": False, "message": f"'{stop}' not found as a real place"}
        else:
            return {"valid": True, "message": "Cannot verify position without API key", "skipped": True}
    
    # Check if stop is roughly between origin and destination
    # Method: stop should be closer to the route line than a threshold
    total_dist = haversine(origin_coords[0], origin_coords[1], dest_coords[0], dest_coords[1])
    dist_from_origin = haversine(origin_coords[0], origin_coords[1], stop_coords[0], stop_coords[1])
    dist_to_dest = haversine(stop_coords[0], stop_coords[1], dest_coords[0], dest_coords[1])
    
    # Stop is "between" if dist_from_origin + dist_to_dest is not much more than total_dist
    # Allow 40% detour tolerance for road curves
    tolerance = total_dist * 1.4
    is_between = (dist_from_origin + dist_to_dest) <= tolerance
    
    if is_between:
        return {
            "valid": True,
            "stop": stop,
            "dist_from_origin_km": round(dist_from_origin, 1),
            "dist_to_dest_km": round(dist_to_dest, 1),
        }
    else:
        return {
            "valid": False,
            "message": f"'{stop}' doesn't appear to be on the route between {origin} and {destination}. It may be {round(min(dist_from_origin, dist_to_dest), 1)}km off-route.",
        }
