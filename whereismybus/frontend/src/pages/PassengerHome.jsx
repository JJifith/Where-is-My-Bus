import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../api";

export default function PassengerHome() {
  const navigate = useNavigate();
  const [liveCount, setLiveCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    api.get("/buses").then(r => {
      setTotalCount(r.data.length);
      setLiveCount(r.data.filter(b => b.current_lat).length);
    }).catch(() => {});
  }, []);

  return (
    <>
      <Navbar />
      <div style={{ minHeight: "calc(100vh - 56px)", background: "linear-gradient(160deg, #0f2340 0%, #1a3a5c 50%, #1a5276 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 72, marginBottom: 16, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>🚌</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "white", letterSpacing: -1, marginBottom: 10 }}>Where Is My Bus?</h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, marginBottom: 8 }}>Real-time bus tracking for Kottayam routes</p>
          {liveCount > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 20, padding: "6px 16px", marginTop: 8 }}>
              <span style={{ width: 8, height: 8, background: "#10b981", borderRadius: "50%", display: "inline-block", animation: "pulse 1.5s infinite" }}></span>
              <span style={{ color: "#6ee7b7", fontSize: 13, fontWeight: 600 }}>{liveCount} bus{liveCount > 1 ? "es" : ""} live now</span>
            </div>
          )}
        </div>

        {/* Main CTA */}
        <button
          onClick={() => navigate("/search")}
          style={{ background: "white", color: "#1a3a5c", border: "none", borderRadius: 16, padding: "18px 48px", fontSize: 18, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", marginBottom: 48, transition: "transform 0.15s", letterSpacing: -0.3 }}
          onMouseOver={e => e.target.style.transform = "translateY(-2px)"}
          onMouseOut={e => e.target.style.transform = "translateY(0)"}
        >
          🔍 Track Your Bus
        </button>

        {/* Quick stats */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginBottom: 48 }}>
          {[
            { icon: "🚌", val: totalCount, label: "Routes" },
            { icon: "📡", val: liveCount, label: "Live Now" },
            { icon: "📍", val: "Kottayam", label: "District" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "16px 24px", textAlign: "center", minWidth: 100 }}>
              <div style={{ fontSize: 24 }}>{s.icon}</div>
              <div style={{ color: "white", fontWeight: 700, fontSize: 20, marginTop: 4 }}>{s.val}</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "20px 28px", maxWidth: 480, width: "100%" }}>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>How it works</div>
          {[
            ["🔍", "Search by stop, route or bus number"],
            ["📍", "See live bus location on the route line"],
            ["⏱️", "Get estimated arrival time at your stop"],
            ["🗺️", "View exact location on map if needed"],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
              <span style={{ fontSize: 16 }}>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>

        {/* Staff login link */}
        <button onClick={() => navigate("/login")} style={{ marginTop: 28, background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.5)", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer" }}>
          Staff Login →
        </button>
      </div>
    </>
  );
}
