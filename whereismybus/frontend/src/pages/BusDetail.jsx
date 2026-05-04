import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../api";

const MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY || "";
const parseStops = (s) => { try { return JSON.parse(s); } catch { return s.split(",").map(x => x.trim()); } };

function haversineJS(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Approximate GPS coords for Kottayam area stops (mirrors stop_utils.py)
const STOP_COORDS = {
  "Kottayam KSRTC": [9.5916, 76.5222], "Kottayam": [9.5916, 76.5222],
  "Ettumanoor": [9.6748, 76.5592], "Vaikom": [9.7520, 76.3970],
  "Thuravoor": [9.8200, 76.3500], "Cherthala": [9.8816, 76.3388],
  "Ernakulam KSRTC": [9.9816, 76.2999], "Ernakulam": [9.9816, 76.2999],
  "Kumarakom Junction": [9.6230, 76.4280], "Kumarakom": [9.6230, 76.4280],
  "Kavalam": [9.5800, 76.4500], "Changanacherry": [9.4481, 76.5414],
  "Kanjikuzhy": [9.6200, 76.5600], "Pala": [9.7060, 76.6880],
  "Kuravilangad": [9.7983, 76.6197], "Erattupetta": [9.8830, 76.7810],
  "Mundakayam": [9.5166, 76.8500], "Ponkunnam": [9.6333, 76.8166],
  "Kanjirapally": [9.5500, 76.7833], "Muhamma": [9.6800, 76.3800],
  "Purakkad": [9.7500, 76.3500], "Alappuzha KSRTC": [9.4981, 76.3388],
  "Alappuzha": [9.4981, 76.3388], "Kumaranalloor": [9.6050, 76.5400],
  "Samkranthi": [9.6150, 76.5480], "Adichira": [9.6250, 76.5500],
  "Caritas": [9.6350, 76.5530], "Thellakom": [9.6500, 76.5560],
  "101 Junction": [9.6620, 76.5575],
};

function getStopCoords(name) {
  if (STOP_COORDS[name]) return STOP_COORDS[name];
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(STOP_COORDS)) {
    if (k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())) return v;
  }
  return null;
}

// Find which segment the bus is on from its GPS coords
function findBusSegment(stops, busLat, busLng) {
  let minDist = Infinity, closestIdx = 0;
  stops.forEach((stop, i) => {
    const c = getStopCoords(stop);
    if (!c) return;
    const d = haversineJS(busLat, busLng, c[0], c[1]);
    if (d < minDist) { minDist = d; closestIdx = i; }
  });
  let label = "";
  if (minDist <= 0.4) {
    label = `At ${stops[closestIdx]}`;
  } else if (closestIdx < stops.length - 1) {
    label = `Between ${stops[closestIdx]} and ${stops[closestIdx + 1]}`;
  } else {
    label = `Near ${stops[closestIdx]}`;
  }
  return { idx: closestIdx, label, distToClosest: minDist };
}

function RouteMap({ stops, busLat, busLng }) {
  if (!MAPS_KEY || MAPS_KEY === "YOUR_GOOGLE_MAPS_API_KEY_HERE") {
    return (
      <div style={{ background: "#f0f6fd", border: "1.5px dashed #b3cfe8", borderRadius: 12, height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#5a7fa6", fontSize: 14 }}>
        <div style={{ fontSize: 32 }}>🗺️</div>
        <div style={{ fontWeight: 600 }}>Map not configured</div>
        <div style={{ fontSize: 12 }}>Add REACT_APP_GOOGLE_MAPS_KEY to frontend/.env</div>
        {busLat && <div style={{ background: "white", padding: "6px 14px", borderRadius: 8, fontSize: 12 }}>📍 Bus: {busLat.toFixed(5)}, {busLng.toFixed(5)}</div>}
      </div>
    );
  }

  const origin = encodeURIComponent(stops[0] + ", Kottayam, Kerala");
  const dest = encodeURIComponent(stops[stops.length - 1] + ", Kerala");

  // Use place map mode to show bus location, directions mode doesn't support markers
  if (busLat) {
    // Show bus current location with nearby area
    const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${busLat},${busLng}&zoom=14`;
    return (
      <div>
        <div style={{ borderRadius: 12, overflow: "hidden", border: "1.5px solid #d1d9e0", marginBottom: 8 }}>
          <iframe title="Bus Location" width="100%" height="260" style={{ border: 0 }} loading="lazy" allowFullScreen src={mapUrl} />
        </div>
        <a href={`https://www.google.com/maps/dir/${encodeURIComponent(stops[0] + ", Kerala")}/${encodeURIComponent(stops[stops.length - 1] + ", Kerala")}`}
          target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#1a3a5c", textDecoration: "none", background: "#f0f6fd", padding: "8px 14px", borderRadius: 8, fontWeight: 500 }}>
          🗺️ Open full route in Google Maps →
        </a>
      </div>
    );
  }

  const mapUrl = `https://www.google.com/maps/embed/v1/directions?key=${MAPS_KEY}&origin=${origin}&destination=${dest}&mode=driving`;
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1.5px solid #d1d9e0" }}>
      <iframe title="Route Map" width="100%" height="280" style={{ border: 0 }} loading="lazy" allowFullScreen src={mapUrl} />
    </div>
  );
}

export default function BusDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const highlight = searchParams.get("highlight") || "";

  const [bus, setBus] = useState(null);
  const [userEta, setUserEta] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState("");
  const [showMap, setShowMap] = useState(false);

  const fetchBus = useCallback(async () => {
    try {
      const res = await api.get(`/buses/${id}`);
      setBus(res.data);
    } catch { navigate("/search"); }
  }, [id, navigate]);

  useEffect(() => {
    fetchBus();
    const interval = setInterval(fetchBus, 8000);
    return () => clearInterval(interval);
  }, [fetchBus]);

  const getMyLocation = () => {
    setLocLoading(true);
    setLocError("");
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported on this browser.");
      setLocLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await api.get(`/buses/${id}/eta?user_lat=${latitude}&user_lng=${longitude}`);
          setUserEta({ ...res.data, userLat: latitude, userLng: longitude });
        } catch { setLocError("Could not calculate ETA. Make sure bus is live."); }
        setLocLoading(false);
      },
      (err) => {
        if (err.code === 1) setLocError("Location access denied. Please allow location in browser settings.");
        else setLocError("Could not get location. Try again.");
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!bus) return (
    <><Navbar /><div className="container"><div className="empty"><div className="empty-icon">⏳</div><div>Loading...</div></div></div></>
  );

  const stops = parseStops(bus.route_stops);
  const isLive = !!bus.current_lat;
  const timetable = [...(bus.timetable || [])].sort((a, b) => a.stop_order - b.stop_order);
  const ttMap = {};
  timetable.forEach(t => { ttMap[t.stop_name] = t.arrival_time; });

  // Calculate bus segment directly from GPS — no need to wait for user ETA
  const busSegment = isLive ? findBusSegment(stops, bus.current_lat, bus.current_lng) : null;
  const segIdx = userEta?.segment_index ?? busSegment?.idx ?? -1;
  const segLabel = userEta?.current_segment ?? busSegment?.label ?? "";

  // Per-stop ETAs from backend /eta response
  const stopEtaMap = {};
  if (userEta?.stop_etas) userEta.stop_etas.forEach(e => { stopEtaMap[e.stop] = e; });

  // Calculate user ETA from stop_etas if available, otherwise show distance
  const etaMinutes = userEta?.eta_minutes;
  const distKm = userEta?.distance_km;

  return (
    <>
      <Navbar />
      <div className="container">
        <button onClick={() => navigate(-1)} className="btn btn-outline btn-sm" style={{ marginBottom: 16 }}>← Back</button>

        {/* Header */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span className="bus-number">{bus.bus_number}</span>
                <span className={`badge ${isLive ? "badge-live" : "badge-offline"}`}>
                  {isLive && <span className="live-dot"></span>}
                  {isLive ? "Live Tracking" : "Offline"}
                </span>
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a202c" }}>{bus.bus_name}</h1>
              <p style={{ color: "#6b7a8d", fontSize: 14, marginTop: 4 }}>🛣️ {bus.route_name}</p>
            </div>
            <span style={{ fontSize: 32 }}>🚌</span>
          </div>
          {bus.location_updated_at && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#8a9bb0" }}>
              📡 Last updated: {new Date(bus.location_updated_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}
            </div>
          )}
        </div>

        {/* Live panel */}
        {isLive && (
          <div style={{ background: "linear-gradient(135deg, #1a3a5c, #2563a0)", borderRadius: 14, padding: 20, marginBottom: 16, color: "white" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ width: 8, height: 8, background: "#10b981", borderRadius: "50%", display: "inline-block", animation: "pulse 1.5s infinite" }}></span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Bus is on duty</span>
              {segLabel && <span style={{ fontSize: 12, opacity: 0.75 }}>— {segLabel}</span>}
            </div>

            {/* Last / Next stops — shown immediately from bus GPS, no user location needed */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, opacity: 0.65, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Last Stop</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{segIdx >= 0 ? stops[segIdx] : stops[0]}</div>
                {ttMap[stops[segIdx]] && <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>Sched: {ttMap[stops[segIdx]]}</div>}
              </div>
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, opacity: 0.65, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Next Stop</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{segIdx >= 0 && segIdx < stops.length - 1 ? stops[segIdx + 1] : "Last stop reached"}</div>
                {segIdx >= 0 && segIdx < stops.length - 1 && ttMap[stops[segIdx + 1]] && (
                  <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>Sched: {ttMap[stops[segIdx + 1]]}</div>
                )}
                {stopEtaMap[stops[segIdx + 1]] && (
                  <div style={{ fontSize: 11, color: "#6ee7b7", marginTop: 2, fontWeight: 600 }}>~{stopEtaMap[stops[segIdx + 1]].eta_minutes} min away</div>
                )}
              </div>
            </div>

            {/* User ETA */}
            {userEta ? (
              <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
                      {etaMinutes != null ? `${etaMinutes} min` : "Calculating..."}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                      to your location{distKm > 0.1 ? ` · ${distKm} km away` : " · you are very close!"}
                    </div>
                  </div>
                  <button onClick={getMyLocation} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
                    🔄 Refresh
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {locError && <div style={{ background: "rgba(220,53,69,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 10 }}>{locError}</div>}
                <button className="btn" onClick={getMyLocation} disabled={locLoading}
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", width: "100%", justifyContent: "center" }}>
                  {locLoading ? "⏳ Getting your location..." : "📍 Get ETA to My Location"}
                </button>
                <div style={{ fontSize: 11, opacity: 0.6, textAlign: "center", marginTop: 6 }}>
                  💡 Open this page on your phone for accurate GPS location
                </div>
              </div>
            )}
          </div>
        )}

        {!isLive && (
          <div className="card" style={{ background: "#f8fafc", textAlign: "center", padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
            <div style={{ fontWeight: 600, color: "#374151" }}>Bus not on duty</div>
            <div style={{ fontSize: 13, color: "#6b7a8d", marginTop: 4 }}>Check timetable below for scheduled times.</div>
          </div>
        )}

        {/* Route card */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: "#1a3a5c", fontSize: 15 }}>🛤️ Route</div>
            <button onClick={() => setShowMap(!showMap)}
              style={{ background: showMap ? "#1a3a5c" : "white", color: showMap ? "white" : "#1a3a5c", border: "1.5px solid #1a3a5c", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              {showMap ? "Hide Map" : "🗺️ View on Map"}
            </button>
          </div>

          {showMap && (
            <div style={{ marginBottom: 20 }}>
              <RouteMap stops={stops} busLat={bus.current_lat} busLng={bus.current_lng} />
            </div>
          )}

          {/* Train-style route line */}
          <div style={{ paddingLeft: 4 }}>
            {stops.map((stop, i) => {
              const isBusHere = isLive && i === segIdx;
              const isBusPassed = isLive && i < segIdx;
              const isBusNext = isLive && i === segIdx + 1;
              const isHighlighted = highlight && stop.toLowerCase().includes(highlight.toLowerCase());
              const isFirst = i === 0, isLast = i === stops.length - 1;
              const stopEta = stopEtaMap[stop];
              const scheduled = ttMap[stop];

              return (
                <div key={i} style={{ display: "flex" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0 }}>
                    <div style={{ width: 3, height: isFirst ? 12 : 20, background: isFirst ? "transparent" : (isBusPassed || isBusHere) ? "#1a3a5c" : "#e2e8f0", borderRadius: 2 }} />
                    <div style={{
                      width: isBusHere ? 16 : isFirst || isLast ? 13 : 10,
                      height: isBusHere ? 16 : isFirst || isLast ? 13 : 10,
                      borderRadius: "50%",
                      background: isBusHere ? "#10b981" : isHighlighted ? "#f59e0b" : isFirst ? "#059669" : isLast ? "#dc2626" : isBusPassed ? "#1a3a5c" : "#d1d9e0",
                      border: isBusHere ? "3px solid white" : "2.5px solid white",
                      boxShadow: isBusHere ? "0 0 0 3px #10b981, 0 0 14px rgba(16,185,129,0.5)" : isHighlighted ? "0 0 0 3px rgba(245,158,11,0.3)" : "0 1px 3px rgba(0,0,0,0.08)",
                      flexShrink: 0, zIndex: 2,
                    }} />
                    {!isLast && <div style={{ width: 3, flex: 1, minHeight: 20, background: isBusPassed ? "#1a3a5c" : "#e2e8f0", borderRadius: 2 }} />}
                  </div>

                  <div style={{ flex: 1, paddingLeft: 12, paddingTop: isFirst ? 6 : 12, paddingBottom: isLast ? 4 : 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: isFirst || isLast ? 15 : 14, fontWeight: isBusHere || isFirst || isLast || isHighlighted ? 700 : 400, color: isBusHere ? "#059669" : isHighlighted ? "#92400e" : "#1a202c" }}>
                        {stop}
                      </span>
                      {isBusHere && <span style={{ background: "#d1fae5", color: "#065f46", fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 5, height: 5, background: "#10b981", borderRadius: "50%", animation: "pulse 1.5s infinite" }}></span> BUS HERE</span>}
                      {isBusNext && <span style={{ background: "#e0f2fe", color: "#0369a1", fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>NEXT</span>}
                      {isHighlighted && !isBusHere && <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>📍 Your stop</span>}
                      {isFirst && <span style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>START</span>}
                      {isLast && <span style={{ fontSize: 10, color: "#dc2626", fontWeight: 700 }}>END</span>}
                      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                        {stopEta && <span style={{ fontSize: 12, fontWeight: 700, color: "#1a3a5c", background: "#e8f0f7", padding: "2px 8px", borderRadius: 20 }}>~{stopEta.eta_minutes}m</span>}
                        {scheduled && <span style={{ fontSize: 12, color: "#6b7a8d" }}>🕐 {scheduled}</span>}
                      </div>
                    </div>
                    {!isLast && <div style={{ height: 4 }} />}
                  </div>
                </div>
              );
            })}
          </div>

          {isLive && (
            <div style={{ display: "flex", gap: 14, paddingTop: 12, borderTop: "1px solid #f0f4f8", marginTop: 8, fontSize: 11, color: "#6b7a8d", flexWrap: "wrap" }}>
              {[["#10b981", "Bus location"], ["#1a3a5c", "Passed"], ["#d1d9e0", "Upcoming"], ...(highlight ? [["#f59e0b", "Your stop"]] : [])].map(([color, label]) => (
                <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 9, height: 9, background: color, borderRadius: "50%", display: "inline-block" }} /> {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Timetable */}
        {timetable.length > 0 && (
          <div className="card">
            <div style={{ fontWeight: 700, color: "#1a3a5c", marginBottom: 14, fontSize: 15 }}>🕐 Full Timetable</div>
            <table className="timetable-table">
              <thead><tr><th>#</th><th>Stop</th><th>Scheduled</th>{userEta && <th>ETA</th>}</tr></thead>
              <tbody>
                {timetable.map(t => {
                  const isHl = highlight && t.stop_name.toLowerCase().includes(highlight.toLowerCase());
                  const stopE = stopEtaMap[t.stop_name];
                  return (
                    <tr key={t.id} style={{ background: isHl ? "#fffbeb" : undefined }}>
                      <td style={{ color: "#8a9bb0", fontSize: 12 }}>{t.stop_order}</td>
                      <td style={{ fontWeight: isHl ? 700 : 400 }}>{t.stop_name}</td>
                      <td style={{ fontWeight: 600, color: "#1a3a5c" }}>{t.arrival_time}</td>
                      {userEta && <td style={{ fontWeight: 600, color: stopE ? "#059669" : "#94a3b8" }}>{stopE ? `~${stopE.eta_minutes}m` : "—"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile access tip */}
        <div className="card" style={{ background: "#f0f6fd", border: "1px solid #bdd6f0" }}>
          <div style={{ fontSize: 13, color: "#1a3a5c" }}>
            <strong>📱 Better accuracy on mobile:</strong> Open <code style={{ background: "white", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>http://YOUR_LAPTOP_IP:3000</code> on your phone.
            Find your IP by running <code style={{ background: "white", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>ipconfig</code> in Windows terminal (look for IPv4 Address).
            Both phone and laptop must be on the same WiFi.
          </div>
        </div>
      </div>
    </>
  );
}
