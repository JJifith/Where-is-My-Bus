import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import PassengerHome from "./pages/PassengerHome";
import SearchPage from "./pages/SearchPage";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import InchargeDashboard from "./pages/InchargeDashboard";
import BusDetail from "./pages/BusDetail";
import "./App.css";

function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PassengerHome />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/bus/:id" element={<BusDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={
            <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/incharge" element={
            <ProtectedRoute role="incharge"><InchargeDashboard /></ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
