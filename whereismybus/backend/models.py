from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # admin | incharge
    phone = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Bus(Base):
    __tablename__ = "buses"
    id = Column(Integer, primary_key=True, index=True)
    bus_number = Column(String, unique=True, nullable=False)
    bus_name = Column(String, nullable=False)
    route_name = Column(String, nullable=False)
    route_stops = Column(Text, nullable=False)   # JSON string list of stops
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    location_updated_at = Column(DateTime(timezone=True), nullable=True)
    active_incharge_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    timetable = relationship("Timetable", back_populates="bus", cascade="all, delete")
    active_incharge = relationship("User", foreign_keys=[active_incharge_id])

class Timetable(Base):
    __tablename__ = "timetable"
    id = Column(Integer, primary_key=True, index=True)
    bus_id = Column(Integer, ForeignKey("buses.id"), nullable=False)
    stop_name = Column(String, nullable=False)
    arrival_time = Column(String, nullable=False)  # HH:MM 24hr
    stop_order = Column(Integer, nullable=False)
    bus = relationship("Bus", back_populates="timetable")
