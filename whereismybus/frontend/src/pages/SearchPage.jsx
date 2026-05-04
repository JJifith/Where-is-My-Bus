import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../api";

const parseStops = (s) => { try { return JSON.parse(s); } catch { return s.split(",").map(x => x.trim()); } };

function StopAutocomplete({ value, onChange, placeholder, allStops }) {
  const [suggestions, setSuggestions] = useState([]);
  const [show, setShow] = useState(false);

  const handleChange = (val) => {
    onChange(val);
    if (val.length >= 2) {
      setSuggestions(allStops.filter(s => s.toLowerCase().includes(val.toLowerCase())).slice(0, 7));
      setShow(true);
    } else { setSuggestions([]); setShow(false); }
  };

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <div className="search-wrap" style={{ marginBottom: 0 }}>
        <span className="search-icon">🔍</span>
        <input type="text" placeholder={placeholder} value={value}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => value.length >= 2 && setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 150)} />
      </div>
      {show && suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1.5px solid #d1d9e0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 100, marginTop: 4, overflow: "hidden" }}>
          {suggestions.map((s, i) => (
            <div key={i} onMouseDown={() => { onChange(s); setShow(false); }}
              style={{ padding: "10px 16px", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 8, borderBottom: i < suggestions.length - 1 ? "1px solid #f0f4f8" : "none" }}
              onMouseOver={e => e.currentTarget.style.background = "#f0f6fd"}
              onMouseOut={e => e.currentTarget.style.background = "white"}>
              <span>🛑</span><span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Check if stopA comes before stopB in the bus route
function isStopBetween(stops, from, to) {
  const lower = stops.map(s => s.toLowerCase());
  const fromIdx = lower.findIndex(s => s.includes(from.toLowerCase()));
  const toIdx = lower.findIndex(s => s.includes(to.toLowerCase()));
  if (fromIdx === -1 || toIdx === -1) return false;
  return fromIdx < toIdx;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("stop");
  const [allStops, setAllStops] = useState([]);

  // Stop mode
  const [stopQuery, setStopQuery] = useState("");

  // Route mode — source + destination
  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo, setRouteTo] = useState("");

  // Bus mode
  const [busQuery, setBusQuery] = useState("");
  const [busResults, setBusResults] = useState([]);
  const [busSuggestions, setBusSuggestions] = useState([]);
  const [showBusSug, setShowBusSug] = useState(false);
  const [allBuses, setAllBuses] = useState([]);

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    api.get("/stops/autocomplete").then(r => setAllStops(r.data)).catch(() => {});
    api.get("/buses").then(r => setAllBuses(r.data)).catch(() => {});
  }, []);

  const searchByStop = async (q) => {
    if (!q.trim()) return;
    setLoading(true); setSearched(true);
    const res = await api.get("/buses");
    const term = q.toLowerCase();
    const found = res.data.filter(bus => parseStops(bus.route_stops).some(s => s.toLowerCase().includes(term)));
    setResults(found);
    setLoading(false);
  };

  const searchByRoute = async () => {
    if (!routeFrom.trim() || !routeTo.trim()) return;
    setLoading(true); setSearched(true);
    const res = await api.get("/buses");
    const from = routeFrom.toLowerCase().trim();
    const to = routeTo.toLowerCase().trim();
    // Find buses that have BOTH stops, and from comes BEFORE to
    const found = res.data.filter(bus => {
      const stops = parseStops(bus.route_stops);
      return isStopBetween(stops, from, to);
    });
    setResults(found);
    setLoading(false);
  };

  const searchByBus = async (q) => {
    if (!q.trim()) return;
    setLoading(true); setSearched(true);
    const res = await api.get(`/buses/search?q=${encodeURIComponent(q)}`);
    setResults(res.data);
    setLoading(false);
  };

  const handleBusInput = (val) => {
    setBusQuery(val);
    if (val.length >= 2) {
      const term = val.toLowerCase();
      setBusSuggestions(allBuses.filter(b =>
        b.bus_name.toLowerCase().includes(term) || b.bus_number.toLowerCase().includes(term)
      ).slice(0, 6));
      setShowBusSug(true);
    } else { setBusSuggestions([]); setShowBusSug(false); }
  };

  const getMatchInfo = (bus, q) => {
    const stops = parseStops(bus.route_stops);
    const idx = stops.findIndex(s => s.toLowerCase().includes(q.toLowerCase()));
    return idx >= 0 ? { stop: stops[idx], index: idx, total: stops.length } : null;
  };

  const getRouteMatchInfo = (bus) => {
    const stops = parseStops(bus.route_stops);
    const fromIdx = stops.findIndex(s => s.toLowerCase().includes(routeFrom.toLowerCase()));
    const toIdx = stops.findIndex(s => s.toLowerCase().includes(routeTo.toLowerCase()));
    return { fromStop: stops[fromIdx], toStop: stops[toIdx], fromIdx, toIdx, total: stops.length };
  };

  const modes = [
    { key: "stop", label: "🛑 By Stop" },
    { key: "route", label: "🛣️ By Route" },
    { key: "bus", label: "🚌 By Bus" },
  ];

  const hasResults = !loading && searched && results.length > 0;
  const noResults = !loading && searched && results.length === 0;

  return (
    <>
      <Navbar />
      <div className="container">
        <button onClick={() => navigate("/")} className="btn btn-outline btn-sm" style={{ marginBottom: 16 }}>← Home</button>
        <div className="page-title">Find Your Bus</div>

        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {modes.map(m => (
            <button key={m.key} onClick={() => { setMode(m.key); setResults([]); setSearched(false); }}
              style={{ flex: 1, padding: "10px 6px", borderRadius: 10, border: `2px solid ${mode === m.key ? "#1a3a5c" : "#e2e8f0"}`, background: mode === m.key ? "#1a3a5c" : "white", color: mode === m.key ? "white" : "#6b7a8d", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.15s" }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* ── STOP MODE ── */}
        {mode === "stop" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <StopAutocomplete value={stopQuery} onChange={setStopQuery} placeholder="e.g. Ettumanoor, Caritas, 101 Junction..." allStops={allStops} />
              <button className="btn btn-primary" onClick={() => searchByStop(stopQuery)}>Search</button>
            </div>
            <div style={{ fontSize: 12, color: "#6b7a8d", marginBottom: 16 }}>
              Type any stop — including intermediate stops. All buses passing through it will appear.
            </div>
          </div>
        )}

        {/* ── ROUTE MODE ── */}
        {mode === "route" && (
          <div>
            <div style={{ background: "white", border: "1.5px solid #d1d9e0", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12 }}>Where are you going?</div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#059669", border: "2px solid white", boxShadow: "0 0 0 2px #059669" }} />
                  <div style={{ width: 2, height: 24, background: "#d1d9e0", margin: "3px 0" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626", border: "2px solid white", boxShadow: "0 0 0 2px #dc2626" }} />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <StopAutocomplete value={routeFrom} onChange={setRouteFrom} placeholder="From — e.g. Kottayam, Pala..." allStops={allStops} />
                  <StopAutocomplete value={routeTo} onChange={setRouteTo} placeholder="To — e.g. Ernakulam, Ettumanoor..." allStops={allStops} />
                </div>
              </div>

              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={searchByRoute} disabled={!routeFrom.trim() || !routeTo.trim()}>
                🔍 Find Buses
              </button>
            </div>
            <div style={{ fontSize: 12, color: "#6b7a8d", marginBottom: 8 }}>
              💡 You can enter any stop — source, destination, or any stop in between. Buses that go from your From stop to your To stop (in that direction) will be shown.
            </div>
          </div>
        )}

        {/* ── BUS MODE ── */}
        {mode === "bus" && (
          <div>
            <div style={{ position: "relative", display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <div className="search-wrap" style={{ marginBottom: 0 }}>
                  <span className="search-icon">🔍</span>
                  <input type="text" placeholder="Bus name or number e.g. KL-35-A-1001, Ponkunnam..." value={busQuery}
                    onChange={e => handleBusInput(e.target.value)}
                    onFocus={() => busQuery.length >= 2 && setShowBusSug(true)}
                    onBlur={() => setTimeout(() => setShowBusSug(false), 150)} />
                </div>
                {showBusSug && busSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1.5px solid #d1d9e0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 100, marginTop: 4, overflow: "hidden" }}>
                    {busSuggestions.map((b, i) => (
                      <div key={i} onMouseDown={() => { setBusQuery(b.bus_name); setShowBusSug(false); searchByBus(b.bus_name); }}
                        style={{ padding: "10px 16px", cursor: "pointer", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < busSuggestions.length - 1 ? "1px solid #f0f4f8" : "none" }}
                        onMouseOver={e => e.currentTarget.style.background = "#f0f6fd"}
                        onMouseOut={e => e.currentTarget.style.background = "white"}>
                        <span>🚌 {b.bus_name}</span>
                        <span style={{ fontSize: 11, color: "#8a9bb0" }}>{b.bus_number}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn btn-primary" onClick={() => searchByBus(busQuery)}>Search</button>
            </div>
            <div style={{ fontSize: 12, color: "#6b7a8d", marginBottom: 16 }}>Search by bus number (KL-35...) or bus name.</div>
          </div>
        )}

        {/* Results */}
        {loading && <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Searching...</div></div>}

        {noResults && (
          <div className="empty">
            <div className="empty-icon">🚫</div>
            <div className="empty-text">
              {mode === "route" ? `No buses found from "${routeFrom}" to "${routeTo}"` : "No buses found"}
            </div>
            <div style={{ fontSize: 13, color: "#8a9bb0", marginTop: 8 }}>Try different stop names or check spelling</div>
          </div>
        )}

        {hasResults && (
          <div>
            <div style={{ fontSize: 13, color: "#6b7a8d", marginBottom: 12, fontWeight: 500 }}>
              {results.length} bus{results.length !== 1 ? "es" : ""} found
              {mode === "route" && ` from ${routeFrom} → ${routeTo}`}
              {mode === "stop" && ` passing through "${stopQuery}"`}
            </div>
            <div className="bus-list">
              {results.map(bus => {
                const stops = parseStops(bus.route_stops);
                const isLive = !!bus.current_lat;
                const matchInfo = mode === "stop" ? getMatchInfo(bus, stopQuery) : null;
                const routeInfo = mode === "route" ? getRouteMatchInfo(bus) : null;

                return (
                  <div key={bus.id} className="bus-card" onClick={() => navigate(`/bus/${bus.id}${mode === "stop" && stopQuery ? `?highlight=${encodeURIComponent(stopQuery)}` : ""}`)}>
                    <div className="bus-card-top">
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span className="bus-number">{bus.bus_number}</span>
                          <span className={`badge ${isLive ? "badge-live" : "badge-offline"}`}>
                            {isLive && <span className="live-dot"></span>}
                            {isLive ? "Live" : "Offline"}
                          </span>
                        </div>
                        <div className="bus-name">{bus.bus_name}</div>
                        <div className="bus-route" style={{ marginTop: 3 }}>🛣️ {bus.route_name}</div>

                        {matchInfo && (
                          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
                              📍 Stop {matchInfo.index + 1} of {matchInfo.total}
                            </span>
                            <span style={{ fontSize: 12, color: "#6b7a8d" }}>{matchInfo.stop}</span>
                          </div>
                        )}

                        {routeInfo && (
                          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
                              📍 {routeInfo.fromStop}
                            </span>
                            <span style={{ fontSize: 11, color: "#8a9bb0" }}>→</span>
                            <span style={{ fontSize: 11, background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
                              🏁 {routeInfo.toStop}
                            </span>
                            <span style={{ fontSize: 11, color: "#8a9bb0" }}>{routeInfo.toIdx - routeInfo.fromIdx} stops between</span>
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 20, color: "#1a3a5c" }}>›</span>
                    </div>

                    {/* Route dots — for route mode highlight only the segment between from and to */}
                    <div className="route-stops">
                      {stops.map((stop, i) => {
                        const isMatchStop = mode === "stop" && stop.toLowerCase().includes(stopQuery.toLowerCase());
                        const isFromStop = mode === "route" && routeInfo && i === routeInfo.fromIdx;
                        const isToStop = mode === "route" && routeInfo && i === routeInfo.toIdx;
                        const isInSegment = mode === "route" && routeInfo && i >= routeInfo.fromIdx && i <= routeInfo.toIdx;
                        const highlight2 = isMatchStop || isFromStop || isToStop;

                        return (
                          <React.Fragment key={i}>
                            {i > 0 && <div className="stop-line" style={{ background: isInSegment ? "#1a3a5c" : undefined }} />}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                              <div className="stop-dot" style={{
                                background: isFromStop ? "#059669" : isToStop ? "#dc2626" : isMatchStop ? "#f59e0b" : i === 0 ? "#059669" : i === stops.length - 1 ? "#dc2626" : isInSegment ? "#1a3a5c" : "#94afc7",
                                width: highlight2 ? 10 : 7, height: highlight2 ? 10 : 7,
                                boxShadow: highlight2 ? "0 0 0 3px rgba(245,158,11,0.25)" : "none"
                              }} />
                              {(i === 0 || i === stops.length - 1 || highlight2) && (
                                <span className="stop-name" style={{ color: isFromStop ? "#059669" : isToStop ? "#dc2626" : isMatchStop ? "#92400e" : undefined, fontWeight: highlight2 ? 600 : 400 }}>
                                  {stop.split(" ")[0]}
                                </span>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
