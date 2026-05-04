import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
        <span>🚌</span> Where Is My Bus
      </div>
      <div className="navbar-actions">
        {title && <span style={{ fontSize: 13, opacity: 0.75 }}>{title}</span>}
        {user ? (
          <>
            <span className={`badge ${user.role === "admin" ? "badge-admin" : "badge-incharge"}`} style={{ marginRight: 4 }}>
              {user.role === "admin" ? "Admin" : "Incharge"}: {user.full_name.split(" ")[0]}
            </span>
            <button className="nav-btn danger" onClick={() => { logout(); navigate("/"); }}>Logout</button>
          </>
        ) : (
          <button className="nav-btn" onClick={() => navigate("/login")}>Staff Login</button>
        )}
      </div>
    </nav>
  );
}
