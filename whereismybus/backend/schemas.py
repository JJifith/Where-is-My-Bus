from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class LoginRequest(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    phone: Optional[str]
    class Config: from_attributes = True

class LoginResponse(BaseModel):
    token: str
    user: UserOut

class CreateIncharge(BaseModel):
    username: str
    password: str
    full_name: str
    phone: Optional[str] = None

class TimetableOut(BaseModel):
    id: int
    stop_name: str
    arrival_time: str
    stop_order: int
    class Config: from_attributes = True

class TimetableCreate(BaseModel):
    stop_name: str
    arrival_time: str
    stop_order: int

class BusOut(BaseModel):
    id: int
    bus_number: str
    bus_name: str
    route_name: str
    route_stops: str
    current_lat: Optional[float]
    current_lng: Optional[float]
    location_updated_at: Optional[datetime]
    class Config: from_attributes = True

class BusDetail(BusOut):
    timetable: List[TimetableOut] = []
    class Config: from_attributes = True

class BusCreate(BaseModel):
    bus_number: str
    bus_name: str
    route_name: str
    route_stops: str  # comma-separated stops

class LocationUpdate(BaseModel):
    lat: float
    lng: float
