import React from "react";

// GOOGLE MAPS API KEY — replace with your own key from Google Cloud Console
// Enable: Maps JavaScript API, Maps Embed API
// Free tier: $200/month credit (plenty for a college project)
const MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY || "YOUR_API_KEY_HERE";

// Kottayam center coordinates
const KOTTAYAM_CENTER = { lat: 9.5916, lng: 76.5222 };

export function BusMap({ busLat, busLng, busName, stops = [] }) {
  if (!MAPS_API_KEY || MAPS_API_KEY === "YOUR_API_KEY_HERE") {
    return (
      <div className="map-fallback">
        <div style={{ fontSize: 36 }}>🗺️</div>
        <div style={{ fontWeight: 600 }}>Map not configured</div>
        <div style={{ fontSize: 12, textAlign: "center", maxWidth: 260 }}>
          Add your Google Maps API key to <code>.env</code> as<br />
          <code>REACT_APP_GOOGLE_MAPS_KEY=your_key</code>
        </div>
        {busLat && (
          <div style={{ marginTop: 12, background: "white", padding: "8px 16px", borderRadius: 8, fontSize: 13, color: "#1a3a5c" }}>
            📍 Bus at: {busLat.toFixed(5)}, {busLng.toFixed(5)}
          </div>
        )}
      </div>
    );
  }

  // Build Google Maps Embed URL with bus marker
  const center = busLat ? `${busLat},${busLng}` : `${KOTTAYAM_CENTER.lat},${KOTTAYAM_CENTER.lng}`;
  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${MAPS_API_KEY}&q=${center}&zoom=13`;

  return (
    <div className="map-container" style={{ height: 320 }}>
      <iframe
        title="Bus Location Map"
        width="100%"
        height="320"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={mapUrl}
      />
    </div>
  );
}

export function KottayamOverviewMap() {
  if (!MAPS_API_KEY || MAPS_API_KEY === "YOUR_API_KEY_HERE") {
    return (
      <div className="map-fallback" style={{ height: 280 }}>
        <div style={{ fontSize: 36 }}>🗺️</div>
        <div style={{ fontWeight: 600 }}>Kottayam Route Map</div>
        <div style={{ fontSize: 12, color: "#5a7fa6" }}>Configure Google Maps API key to see live routes</div>
      </div>
    );
  }

  const mapUrl = `https://www.google.com/maps/embed/v1/view?key=${MAPS_API_KEY}&center=${KOTTAYAM_CENTER.lat},${KOTTAYAM_CENTER.lng}&zoom=11&maptype=roadmap`;

  return (
    <div className="map-container" style={{ height: 280 }}>
      <iframe
        title="Kottayam Overview"
        width="100%"
        height="280"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={mapUrl}
      />
    </div>
  );
}
