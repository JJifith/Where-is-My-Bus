import json
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
import models, schemas, auth_utils

# ── Kottayam real bus routes ──────────────────────────────────────────────────
SEED_BUSES = [
    {
        "bus_number": "KL-35-A-1001",
        "bus_name": "Kottayam Fast",
        "route_name": "Kottayam – Ernakulam",
        "route_stops": json.dumps(["Kottayam KSRTC", "Ettumanoor", "Vaikom", "Thuravoor", "Cherthala", "Ernakulam KSRTC"]),
        "timetable": [
            ("Kottayam KSRTC", "06:00", 1), ("Ettumanoor", "06:25", 2),
            ("Vaikom", "06:55", 3), ("Thuravoor", "07:20", 4),
            ("Cherthala", "07:45", 5), ("Ernakulam KSRTC", "08:30", 6),
        ]
    },
    {
        "bus_number": "KL-35-B-2045",
        "bus_name": "Kumarakom Express",
        "route_name": "Kottayam – Kumarakom – Changanacherry",
        "route_stops": json.dumps(["Kottayam KSRTC", "Kumarakom Junction", "Kavalam", "Changanacherry"]),
        "timetable": [
            ("Kottayam KSRTC", "07:00", 1), ("Kumarakom Junction", "07:30", 2),
            ("Kavalam", "08:00", 3), ("Changanacherry", "08:30", 4),
        ]
    },
    {
        "bus_number": "KL-35-C-3312",
        "bus_name": "Pala Passenger",
        "route_name": "Kottayam – Pala – Erattupetta",
        "route_stops": json.dumps(["Kottayam KSRTC", "Kanjikuzhy", "Pala", "Kuravilangad", "Erattupetta"]),
        "timetable": [
            ("Kottayam KSRTC", "06:30", 1), ("Kanjikuzhy", "06:50", 2),
            ("Pala", "07:25", 3), ("Kuravilangad", "07:50", 4),
            ("Erattupetta", "08:30", 5),
        ]
    },
    {
        "bus_number": "KL-35-D-4501",
        "bus_name": "Ponkunnam Deluxe",
        "route_name": "Kottayam – Ponkunnam – Kanjirapally",
        "route_stops": json.dumps(["Kottayam KSRTC", "Mundakayam", "Ponkunnam", "Kanjirapally"]),
        "timetable": [
            ("Kottayam KSRTC", "08:00", 1), ("Mundakayam", "08:45", 2),
            ("Ponkunnam", "09:20", 3), ("Kanjirapally", "09:50", 4),
        ]
    },
    {
        "bus_number": "KL-35-E-5678",
        "bus_name": "Alappuzha Link",
        "route_name": "Kottayam – Alappuzha",
        "route_stops": json.dumps(["Kottayam KSRTC", "Vaikom", "Muhamma", "Purakkad", "Alappuzha KSRTC"]),
        "timetable": [
            ("Kottayam KSRTC", "09:00", 1), ("Vaikom", "09:40", 2),
            ("Muhamma", "10:10", 3), ("Purakkad", "10:35", 4),
            ("Alappuzha KSRTC", "11:00", 5),
        ]
    },
]

def seed_data(db: Session):
    if db.query(models.User).count() > 0:
        return  # already seeded

    # Admin
    admin = models.User(
        username="admin",
        hashed_password=auth_utils.hash_password("admin123"),
        full_name="System Admin",
        role="admin",
        phone="9400000001"
    )
    db.add(admin)

    # Incharges
    incharges = [
        ("driver_rajan", "driver123", "Rajan K", "9400000002"),
        ("driver_suja", "driver123", "Suja Thomas", "9400000003"),
        ("driver_biju", "driver123", "Biju Mathew", "9400000004"),
    ]
    for uname, pwd, name, phone in incharges:
        db.add(models.User(
            username=uname,
            hashed_password=auth_utils.hash_password(pwd),
            full_name=name,
            role="incharge",
            phone=phone
        ))

    # Buses
    for b in SEED_BUSES:
        bus = models.Bus(
            bus_number=b["bus_number"],
            bus_name=b["bus_name"],
            route_name=b["route_name"],
            route_stops=b["route_stops"],
        )
        db.add(bus)
        db.flush()
        for stop, time, order in b["timetable"]:
            db.add(models.Timetable(
                bus_id=bus.id,
                stop_name=stop,
                arrival_time=time,
                stop_order=order
            ))

    db.commit()

# ── Auth ──────────────────────────────────────────────────────────────────────
def authenticate_user(db: Session, username: str, password: str):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not auth_utils.verify_password(password, user.hashed_password):
        return None
    return user

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

# ── Buses ─────────────────────────────────────────────────────────────────────
def get_all_buses(db: Session):
    return db.query(models.Bus).all()

def get_bus(db: Session, bus_id: int):
    return db.query(models.Bus).filter(models.Bus.id == bus_id).first()

def search_buses(db: Session, q: str = None, stop: str = None):
    query = db.query(models.Bus)
    if q:
        term = f"%{q}%"
        query = query.filter(
            models.Bus.bus_number.ilike(term) |
            models.Bus.bus_name.ilike(term) |
            models.Bus.route_name.ilike(term) |
            models.Bus.route_stops.ilike(term)
        )
    if stop:
        query = query.filter(models.Bus.route_stops.ilike(f"%{stop}%"))
    return query.all()

def create_bus(db: Session, payload: schemas.BusCreate):
    bus = models.Bus(**payload.dict())
    db.add(bus)
    db.commit()
    db.refresh(bus)
    return bus

def update_bus(db: Session, bus_id: int, payload: schemas.BusCreate):
    bus = get_bus(db, bus_id)
    if not bus:
        return None
    for k, v in payload.dict().items():
        setattr(bus, k, v)
    db.commit()
    db.refresh(bus)
    return bus

def delete_bus(db: Session, bus_id: int):
    bus = get_bus(db, bus_id)
    if bus:
        db.delete(bus)
        db.commit()

# ── Timetable ─────────────────────────────────────────────────────────────────
def get_timetable(db: Session, bus_id: int):
    return db.query(models.Timetable).filter(
        models.Timetable.bus_id == bus_id
    ).order_by(models.Timetable.stop_order).all()

def add_timetable(db: Session, bus_id: int, payload: schemas.TimetableCreate):
    tt = models.Timetable(bus_id=bus_id, **payload.dict())
    db.add(tt)
    db.commit()
    db.refresh(tt)
    return tt

def delete_timetable(db: Session, tt_id: int):
    tt = db.query(models.Timetable).filter(models.Timetable.id == tt_id).first()
    if tt:
        db.delete(tt)
        db.commit()

# ── Incharges ─────────────────────────────────────────────────────────────────
def get_incharges(db: Session):
    return db.query(models.User).filter(models.User.role == "incharge").all()

def create_incharge(db: Session, payload: schemas.CreateIncharge):
    user = models.User(
        username=payload.username,
        hashed_password=auth_utils.hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role="incharge"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def delete_user(db: Session, user_id: int):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        db.delete(user)
        db.commit()

# ── Location ──────────────────────────────────────────────────────────────────
def update_bus_location(db: Session, bus_id: int, lat: float, lng: float, incharge_id: int):
    bus = get_bus(db, bus_id)
    if bus:
        bus.current_lat = lat
        bus.current_lng = lng
        bus.active_incharge_id = incharge_id
        bus.location_updated_at = func.now()
        db.commit()

def clear_bus_location(db: Session, bus_id: int):
    bus = get_bus(db, bus_id)
    if bus:
        bus.current_lat = None
        bus.current_lng = None
        bus.active_incharge_id = None
        bus.location_updated_at = None
        db.commit()

# ── Stats ──────────────────────────────────────────────────────────────────────
def get_stats(db: Session):
    total_buses = db.query(models.Bus).count()
    live_buses = db.query(models.Bus).filter(models.Bus.current_lat.isnot(None)).count()
    total_incharges = db.query(models.User).filter(models.User.role == "incharge").count()
    return {
        "total_buses": total_buses,
        "live_buses": live_buses,
        "total_incharges": total_incharges,
        "offline_buses": total_buses - live_buses,
    }
