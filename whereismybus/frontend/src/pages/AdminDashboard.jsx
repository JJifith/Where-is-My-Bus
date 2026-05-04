import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import api from "../api";

const parseStops = (s) => { try { return JSON.parse(s); } catch { return s.split(",").map(x => x.trim()); } };

function StopAutocomplete({ value, onChange, placeholder, allStops }) {
  const [suggestions, setSuggestions] = useState([]);
  const [show, setShow] = useState(false);

  const handleChange = (val) => {
    onChange(val);
    if (val.length >= 2) {
      const last = val.split(",").pop().trim().toLowerCase();
      setSuggestions(allStops.filter(s => s.toLowerCase().includes(last)).slice(0, 6));
      setShow(true);
    } else setShow(false);
  };

  const selectSug = (s) => {
    const parts = value.split(",");
    parts[parts.length - 1] = " " + s;
    onChange(parts.join(",").replace(/^\s*,\s*/, "").replace(/^,/, "").trimStart());
    setShow(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <input className="form-input" placeholder={placeholder} value={value}
        onChange={e => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setShow(false), 150)} />
      {show && suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1.5px solid #d1d9e0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", overflow: "hidden" }}>
          {suggestions.map((s, i) => (
            <div key={i} onMouseDown={() => selectSug(s)}
              style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, borderBottom: i < suggestions.length - 1 ? "1px solid #f0f4f8" : "none" }}
              onMouseOver={e => e.currentTarget.style.background = "#f0f6fd"}
              onMouseOut={e => e.currentTarget.style.background = "white"}>
              🛑 {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("buses");
  const [stats, setStats] = useState(null);
  const [buses, setBuses] = useState([]);
  const [incharges, setIncharges] = useState([]);
  const [allStops, setAllStops] = useState([]);
  const [showBusModal, setShowBusModal] = useState(false);
  const [showInchargeModal, setShowInchargeModal] = useState(false);
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [editBus, setEditBus] = useState(null);
  const [timetableBus, setTimetableBus] = useState(null);
  const [timetableEntries, setTimetableEntries] = useState([]);
  const [alert, setAlert] = useState(null);
  const [stopValidations, setStopValidations] = useState({});
  const [validating, setValidating] = useState(false);
  const [busStep, setBusStep] = useState(1); // 1 = basic info, 2 = stops

  const busForm0 = { bus_number: "", bus_name: "", route_name: "", source: "", destination: "", route_stops: "" };
  const inchargeForm0 = { username: "", password: "", full_name: "", phone: "" };
  const [busForm, setBusForm] = useState(busForm0);
  const [inchargeForm, setInchargeForm] = useState(inchargeForm0);

  useEffect(() => {
    fetchAll();
    api.get("/stops/autocomplete").then(r => setAllStops(r.data)).catch(() => {});
  }, []);

  const fetchAll = async () => {
    const [s, b, i] = await Promise.all([api.get("/admin/stats"), api.get("/buses"), api.get("/incharges")]);
    setStats(s.data); setBuses(b.data); setIncharges(i.data);
  };

  const showAlert = (msg, type = "success") => { setAlert({ msg, type }); setTimeout(() => setAlert(null), 4000); };

  const validateStopsBetween = async () => {
    const stops = busForm.route_stops.split(",").map(s => s.trim()).filter(Boolean);
    const origin = busForm.source.trim();
    const dest = busForm.destination.trim();
    if (!stops.length || !origin || !dest) return;
    setValidating(true);
    const results = {};
    for (const stop of stops) {
      // Source and destination are always valid
      if (stop.toLowerCase() === origin.toLowerCase() || stop.toLowerCase() === dest.toLowerCase()) {
        results[stop] = { valid: true, isEndpoint: true };
        continue;
      }
      try {
        const res = await api.get(`/stops/validate-between?stop=${encodeURIComponent(stop)}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}`);
        results[stop] = res.data;
      } catch { results[stop] = { valid: true, message: "Could not verify", skipped: true }; }
    }
    setStopValidations(results);
    setValidating(false);
  };

  const handleSaveBus = async (e) => {
    e.preventDefault();
    const rawStops = busForm.route_stops.split(",").map(s => s.trim()).filter(Boolean);
    // Prepend source if not already first, append destination if not already last
    let stops = [...rawStops];
    if (stops[0]?.toLowerCase() !== busForm.source.toLowerCase()) stops = [busForm.source.trim(), ...stops];
    if (stops[stops.length - 1]?.toLowerCase() !== busForm.destination.toLowerCase()) stops = [...stops, busForm.destination.trim()];

    if (stops.length < 2) { showAlert("Add at least source and destination", "error"); return; }
    try {
      const routeName = `${busForm.source} – ${busForm.destination}`;
      const payload = {
        bus_number: busForm.bus_number,
        bus_name: busForm.bus_name,
        route_name: busForm.route_name || routeName,
        route_stops: JSON.stringify(stops)
      };
      if (editBus) { await api.put(`/buses/${editBus.id}`, payload); showAlert("Bus updated"); }
      else { await api.post("/buses", payload); showAlert("Bus added"); }
      setShowBusModal(false); setBusForm(busForm0); setEditBus(null); setStopValidations({}); setBusStep(1);
      fetchAll();
    } catch (err) { showAlert(err.response?.data?.detail || "Error", "error"); }
  };

  const handleDeleteBus = async (id) => {
    if (!window.confirm("Delete this bus?")) return;
    await api.delete(`/buses/${id}`); showAlert("Deleted"); fetchAll();
  };

  const handleEditBus = (bus) => {
    const stopsArr = parseStops(bus.route_stops);
    const src = stopsArr[0] || "";
    const dst = stopsArr[stopsArr.length - 1] || "";
    const midStops = stopsArr.slice(1, -1).join(", ");
    setBusForm({ bus_number: bus.bus_number, bus_name: bus.bus_name, route_name: bus.route_name, source: src, destination: dst, route_stops: midStops });
    setEditBus(bus); setStopValidations({}); setBusStep(1); setShowBusModal(true);
  };

  const openTimetable = async (bus) => {
    setTimetableBus(bus);
    const res = await api.get(`/buses/${bus.id}/timetable`);
    const stops = parseStops(bus.route_stops);
    const existing = res.data;
    setTimetableEntries(stops.map((stop, i) => {
      const found = existing.find(e => e.stop_order === i + 1) || existing.find(e => e.stop_name === stop);
      return { stop_name: stop, arrival_time: found?.arrival_time || "", stop_order: i + 1 };
    }));
    setShowTimetableModal(true);
  };

  const handleSaveTimetable = async () => {
    try {
      const existing = await api.get(`/buses/${timetableBus.id}/timetable`);
      for (const e of existing.data) await api.delete(`/timetable/${e.id}`);
      for (const entry of timetableEntries) {
        if (entry.arrival_time.trim()) {
          await api.post(`/buses/${timetableBus.id}/timetable`, { stop_name: entry.stop_name, arrival_time: entry.arrival_time, stop_order: entry.stop_order });
        }
      }
      showAlert("Timetable saved"); setShowTimetableModal(false); fetchAll();
    } catch { showAlert("Error saving timetable", "error"); }
  };

  const handleSaveIncharge = async (e) => {
    e.preventDefault();
    try {
      await api.post("/incharges", inchargeForm);
      showAlert("Incharge registered"); setShowInchargeModal(false); setInchargeForm(inchargeForm0); fetchAll();
    } catch (err) { showAlert(err.response?.data?.detail || "Error", "error"); }
  };

  const handleDeleteIncharge = async (id) => {
    if (!window.confirm("Remove?")) return;
    await api.delete(`/incharges/${id}`); showAlert("Removed"); fetchAll();
  };

  const midStopsArray = busForm.route_stops.split(",").map(s => s.trim()).filter(Boolean);
  const allStopsForValidation = [
    ...(busForm.source ? [busForm.source.trim()] : []),
    ...midStopsArray,
    ...(busForm.destination ? [busForm.destination.trim()] : []),
  ];

  return (
    <>
      <Navbar title="Admin Dashboard" />
      <div className="container">
        <div className="page-title">Admin Dashboard</div>
        {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

        {stats && (
          <div className="stats-grid">
            {[{ label: "Total Buses", val: stats.total_buses, icon: "🚌" }, { label: "Live Now", val: stats.live_buses, icon: "📡" }, { label: "Offline", val: stats.offline_buses, icon: "⭕" }, { label: "Incharges", val: stats.total_incharges, icon: "👤" }].map(s => (
              <div key={s.label} className="stat-card"><div style={{ fontSize: 22 }}>{s.icon}</div><div className="stat-value">{s.val}</div><div className="stat-label">{s.label}</div></div>
            ))}
          </div>
        )}

        <div className="tabs">
          {["buses", "timetable", "incharges"].map(t => (
            <div key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "buses" ? "🚌 Buses" : t === "timetable" ? "🕐 Timetable" : "👤 Incharges"}
            </div>
          ))}
        </div>

        {tab === "buses" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontWeight: 600, color: "#1a3a5c" }}>{buses.length} buses</span>
              <button className="btn btn-primary btn-sm" onClick={() => { setBusForm(busForm0); setEditBus(null); setStopValidations({}); setBusStep(1); setShowBusModal(true); }}>+ Add Bus</button>
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="data-table">
                <thead><tr><th>Bus No</th><th>Name</th><th>Route</th><th>Stops</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {buses.map(b => (
                    <tr key={b.id}>
                      <td><span className="bus-number">{b.bus_number}</span></td>
                      <td style={{ fontWeight: 500 }}>{b.bus_name}</td>
                      <td style={{ fontSize: 13, color: "#6b7a8d" }}>{b.route_name}</td>
                      <td style={{ fontSize: 12, color: "#8a9bb0" }}>{parseStops(b.route_stops).length} stops</td>
                      <td><span className={`badge ${b.current_lat ? "badge-live" : "badge-offline"}`}>{b.current_lat ? <><span className="live-dot"></span> Live</> : "Offline"}</span></td>
                      <td><div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => handleEditBus(b)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBus(b.id)}>Delete</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "timetable" && (
          <div>
            {buses.map(bus => {
              const tt = bus.timetable || [];
              const stops = parseStops(bus.route_stops);
              return (
                <div key={bus.id} className="card" style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#1a3a5c" }}>🚌 {bus.bus_name}</div>
                      <div style={{ fontSize: 12, color: "#8a9bb0" }}>{bus.bus_number} · {stops.length} stops</div>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={() => openTimetable(bus)}>{tt.length > 0 ? "✏️ Edit" : "➕ Add"} Timetable</button>
                  </div>
                  {tt.length > 0 ? (
                    <table className="timetable-table">
                      <thead><tr><th>#</th><th>Stop</th><th>Time</th></tr></thead>
                      <tbody>{[...tt].sort((a, b) => a.stop_order - b.stop_order).map(t => (
                        <tr key={t.id}><td style={{ color: "#8a9bb0", fontSize: 12 }}>{t.stop_order}</td><td>{t.stop_name}</td><td style={{ fontWeight: 600, color: "#1a3a5c" }}>{t.arrival_time}</td></tr>
                      ))}</tbody>
                    </table>
                  ) : <div style={{ fontSize: 13, color: "#8a9bb0", textAlign: "center", padding: "10px 0" }}>No timetable set</div>}
                </div>
              );
            })}
          </div>
        )}

        {tab === "incharges" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontWeight: 600, color: "#1a3a5c" }}>{incharges.length} incharges</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowInchargeModal(true)}>+ Add</button>
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="data-table">
                <thead><tr><th>Name</th><th>Username</th><th>Phone</th><th>Actions</th></tr></thead>
                <tbody>{incharges.map(i => (
                  <tr key={i.id}><td style={{ fontWeight: 500 }}>{i.full_name}</td><td style={{ fontFamily: "monospace", fontSize: 13 }}>{i.username}</td><td style={{ color: "#6b7a8d" }}>{i.phone || "—"}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteIncharge(i.id)}>Remove</button></td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Bus Modal — 2 steps */}
      {showBusModal && (
        <div className="modal-overlay" onClick={() => setShowBusModal(false)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editBus ? "Edit Bus" : "Add New Bus"}</div>

            {/* Step indicator */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[{ n: 1, label: "Bus Info & Route" }, { n: 2, label: "Stops & Validation" }].map(s => (
                <div key={s.n} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: busStep === s.n ? "#1a3a5c" : "#f0f4f8", color: busStep === s.n ? "white" : "#6b7a8d", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer" }}
                  onClick={() => busStep > s.n || (busForm.source && busForm.destination) ? setBusStep(s.n) : null}>
                  {s.n}. {s.label}
                </div>
              ))}
            </div>

            {/* Step 1: Basic info + source/destination */}
            {busStep === 1 && (
              <div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Bus Number</label>
                    <input className="form-input" placeholder="KL-35-A-1234" value={busForm.bus_number} onChange={e => setBusForm({ ...busForm, bus_number: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bus Name</label>
                    <input className="form-input" placeholder="Kottayam Fast" value={busForm.bus_name} onChange={e => setBusForm({ ...busForm, bus_name: e.target.value })} required />
                  </div>
                </div>

                <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12 }}>Route Endpoints</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#059669", border: "2px solid white", boxShadow: "0 0 0 2px #059669" }} />
                      <div style={{ width: 2, height: 28, background: "#d1d9e0", margin: "3px 0" }} />
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626", border: "2px solid white", boxShadow: "0 0 0 2px #dc2626" }} />
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                      <StopAutocomplete value={busForm.source} onChange={val => setBusForm({ ...busForm, source: val })} placeholder="Starting point e.g. Kottayam KSRTC" allStops={allStops} />
                      <StopAutocomplete value={busForm.destination} onChange={val => setBusForm({ ...busForm, destination: val })} placeholder="End point e.g. Ernakulam KSRTC" allStops={allStops} />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Route Name (optional)</label>
                  <input className="form-input" placeholder={busForm.source && busForm.destination ? `${busForm.source} – ${busForm.destination}` : "e.g. Kottayam – Ernakulam"}
                    value={busForm.route_name} onChange={e => setBusForm({ ...busForm, route_name: e.target.value })} />
                  <div style={{ fontSize: 12, color: "#8a9bb0", marginTop: 4 }}>Leave blank to auto-generate from source and destination</div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setShowBusModal(false)}>Cancel</button>
                  <button type="button" className="btn btn-primary" disabled={!busForm.bus_number || !busForm.bus_name || !busForm.source || !busForm.destination}
                    onClick={() => setBusStep(2)}>
                    Next: Add Stops →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Intermediate stops + validation */}
            {busStep === 2 && (
              <div>
                <div style={{ background: "#f0f6fd", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 13, color: "#1a3a5c" }}>
                  Route: <strong>{busForm.source}</strong> → <strong>{busForm.destination}</strong>
                </div>

                <div className="form-group">
                  <label className="form-label">Intermediate Stops (comma-separated, in order)</label>
                  <StopAutocomplete value={busForm.route_stops}
                    onChange={val => { setBusForm({ ...busForm, route_stops: val }); setStopValidations({}); }}
                    placeholder="e.g. Ettumanoor, Vaikom, Thuravoor, Cherthala" allStops={allStops} />
                  <div style={{ fontSize: 12, color: "#8a9bb0", marginTop: 4 }}>
                    Source ({busForm.source}) and destination ({busForm.destination}) are added automatically. Only enter stops in between.
                  </div>
                </div>

                {/* Stop validation */}
                {allStopsForValidation.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Stop Validation</span>
                      <button type="button" className="btn btn-outline btn-sm" onClick={validateStopsBetween} disabled={validating || !busForm.source || !busForm.destination}>
                        {validating ? "⏳ Validating..." : "✅ Validate All Stops"}
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7a8d", marginBottom: 8 }}>
                      Checks that each stop is geographically between {busForm.source} and {busForm.destination}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {allStopsForValidation.map((stop, i) => {
                        const v = stopValidations[stop];
                        const isEndpoint = i === 0 || i === allStopsForValidation.length - 1;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "6px 10px", borderRadius: 6, background: isEndpoint ? "#f0fdf4" : v ? (v.valid ? "#f0fdf4" : "#fef2f2") : "#f8fafc", border: `1px solid ${isEndpoint ? "#bbf7d0" : v ? (v.valid ? "#bbf7d0" : "#fecaca") : "#e2e8f0"}` }}>
                            <span>{isEndpoint ? "🟢" : v ? (v.valid ? "✅" : "❌") : "⬜"}</span>
                            <span style={{ flex: 1, fontWeight: 500 }}>{stop}</span>
                            {isEndpoint && <span style={{ fontSize: 11, color: "#059669" }}>{i === 0 ? "SOURCE" : "DEST"}</span>}
                            {!isEndpoint && v?.valid && v.dist_from_origin_km && <span style={{ fontSize: 11, color: "#6b7a8d" }}>{v.dist_from_origin_km}km from start</span>}
                            {!isEndpoint && v && !v.valid && <span style={{ fontSize: 11, color: "#dc2626" }}>{v.message}</span>}
                            {!isEndpoint && v?.skipped && <span style={{ fontSize: 11, color: "#8a9bb0" }}>Not verified</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setBusStep(1)}>← Back</button>
                  <button type="button" className="btn btn-primary" onClick={handleSaveBus}>
                    {editBus ? "Update Bus" : "Save Bus"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timetable Modal */}
      {showTimetableModal && timetableBus && (
        <div className="modal-overlay" onClick={() => setShowTimetableModal(false)}>
          <div className="modal" style={{ maxWidth: 540, maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">🕐 Timetable — {timetableBus.bus_name}</div>
            <div style={{ fontSize: 13, color: "#6b7a8d", marginBottom: 14 }}>Enter arrival time for each stop (24hr, e.g. 06:30)</div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {timetableEntries.map((entry, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f0f4f8" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: idx === 0 ? "#059669" : idx === timetableEntries.length - 1 ? "#dc2626" : "#1a3a5c", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{idx + 1}</div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{entry.stop_name}</div>
                  <input type="time" value={entry.arrival_time}
                    onChange={e => setTimetableEntries(prev => prev.map((e2, i) => i === idx ? { ...e2, arrival_time: e.target.value } : e2))}
                    style={{ border: "1.5px solid #d1d9e0", borderRadius: 6, padding: "5px 8px", fontSize: 14, width: 110 }} />
                </div>
              ))}
            </div>
            <div className="modal-actions" style={{ paddingTop: 14, borderTop: "1px solid #f0f4f8" }}>
              <button className="btn btn-outline" onClick={() => setShowTimetableModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveTimetable}>💾 Save Timetable</button>
            </div>
          </div>
        </div>
      )}

      {/* Incharge Modal */}
      {showInchargeModal && (
        <div className="modal-overlay" onClick={() => setShowInchargeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Register Bus Incharge</div>
            <form onSubmit={handleSaveIncharge}>
              <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" placeholder="Rajan Kumar" value={inchargeForm.full_name} onChange={e => setInchargeForm({ ...inchargeForm, full_name: e.target.value })} required /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Username</label><input className="form-input" placeholder="driver_rajan" value={inchargeForm.username} onChange={e => setInchargeForm({ ...inchargeForm, username: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" value={inchargeForm.password} onChange={e => setInchargeForm({ ...inchargeForm, password: e.target.value })} required /></div>
              </div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" placeholder="94XXXXXXXX" value={inchargeForm.phone} onChange={e => setInchargeForm({ ...inchargeForm, phone: e.target.value })} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowInchargeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Register</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
