import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await login(form.username, form.password);
      navigate(user.role === "admin" ? "/admin" : "/incharge");
    } catch {
      setError("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🚌</div>
          <div className="login-logo-title">Where Is My Bus</div>
          <div className="login-logo-sub">Bus Tracking System</div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" type="text" placeholder="Enter username"
              value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="Enter password"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 4 }} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: 14, background: "#f8fafc", borderRadius: 8, fontSize: 12, color: "#6b7a8d" }}>
          <strong>Demo credentials:</strong><br />
          Admin: admin / admin123<br />
          Driver: driver_rajan / driver123
        </div>

        <button onClick={() => navigate("/")} style={{ width: "100%", marginTop: 12, background: "none", border: "none", color: "#1a3a5c", cursor: "pointer", fontSize: 13 }}>
          ← Back to Passenger View
        </button>
      </div>
    </div>
  );
}
