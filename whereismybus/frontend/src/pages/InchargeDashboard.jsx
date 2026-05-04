import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import api from "../api";

export default function InchargeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [buses, setBuses] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [currentPos, setCurrentPos] = useState(null);
  const [error, setError] = useState("");
  const [lastSent, setLastSent] = useState(null);
  const watchRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    api.get("/buses").then(r => setBuses(r.data));
    return () => stopSharing();
  }, []);

  const startSharing = () => {
    if (!selectedBus) return;
    setError("");

    if (!navigator.geolocation) {
      setError("Geolocation not supported on this device.");
      return;
    }

    setIsSharing(true);

    // Start watching location
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => setError("Location error: " + err.message),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    // Send to server every 8 seconds
    intervalRef.current = setInterval(async () => {
      if (watchRef.current === null) return;
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          await api.post(`/buses/${selectedBus.id}/location`, { lat, lng });
          setLastSent(new Date());
          setCurrentPos({ lat, lng });
        } catch {
          setError("Failed to send location. Retrying...");
        }
      });
    }, 8000);
  };

  const stopSharing = async () => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (selectedBus && isSharing) {
      try { await api.delete(`/buses/${selectedBus.id}/location`); } catch {}
    }
    setIsSharing(false);
    setCurrentPos(null);
    setLastSent(null);
  };

  const formatTime = (d) => d?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <>
      <Navbar title="Incharge Panel" />
      <div className="container">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a3a5c" }}>Welcome, {user?.full_name} 👋</h2>
          <p style={{ fontSize: 13, color: "#6b7a8d", marginTop: 4 }}>Select your bus and start sharing location</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!isSharing ? (
          <div>
            {/* Select bus */}
            <div className="card">
              <div style={{ fontWeight: 600, color: "#1a3a5c", marginBottom: 14 }}>Select Your Bus</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {buses.map(bus => (
                  <div key={bus.id}
                    onClick={() => setSelectedBus(bus)}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: `2px solid ${selectedBus?.id === bus.id ? "#1a3a5c" : "#e2e8f0"}`,
                      background: selectedBus?.id === bus.id ? "#f0f6fd" : "white",
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{bus.bus_name}</div>
                        <div style={{ fontSize: 12, color: "#6b7a8d", marginTop: 2 }}>{bus.bus_number} · {bus.route_name}</div>
                      </div>
                      {selectedBus?.id === bus.id && <span style={{ color: "#1a3a5c", fontSize: 18 }}>✓</span>}
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="btn btn-green"
                style={{ width: "100%", justifyContent: "center", marginTop: 16 }}
                onClick={startSharing}
                disabled={!selectedBus}
              >
                📍 Start Sharing Location
              </button>
            </div>

            {/* Instructions */}
            <div className="card" style={{ background: "#f8fafc" }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#374151", marginBottom: 10 }}>How it works</div>
              {[
                ["1️⃣", "Select your bus from the list above"],
                ["2️⃣", "Tap 'Start Sharing Location'"],
                ["3️⃣", "Allow location access when prompted"],
                ["4️⃣", "Your phone's GPS is used as the bus location"],
                ["5️⃣", "Passengers can now see the bus in real-time"],
                ["6️⃣", "Tap 'Stop Sharing' when your duty ends"],
              ].map(([icon, text]) => (
                <div key={icon} style={{ display: "flex", gap: 10, padding: "6px 0", fontSize: 14, color: "#374151" }}>
                  <span>{icon}</span><span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {/* Sharing active panel */}
            <div className="sharing-panel">
              <div className="pulse-ring">📡</div>
              <div className="sharing-title">Location Sharing Active</div>
              <div className="sharing-sub">{selectedBus?.bus_name} · {selectedBus?.bus_number}</div>
              {currentPos && (
                <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13 }}>
                  📍 {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)}<br />
                  {lastSent && <span style={{ opacity: 0.8 }}>Last sent: {formatTime(lastSent)}</span>}
                </div>
              )}
              <button className="btn btn-danger" style={{ width: "100%", justifyContent: "center" }} onClick={stopSharing}>
                ⏹ Stop Sharing
              </button>
            </div>

            {/* Route reminder */}
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, color: "#1a3a5c", marginBottom: 10 }}>Your Route: {selectedBus?.route_name}</div>
              <div style={{ fontSize: 13, color: "#6b7a8d" }}>
                {(() => { try { return JSON.parse(selectedBus?.route_stops || "[]").join(" → "); } catch { return selectedBus?.route_stops; } })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
