import math

# GPS coordinates for all Kottayam area stops
STOP_COORDS = {
    "Kottayam KSRTC": (9.5916, 76.5222),
    "Kottayam": (9.5916, 76.5222),
    "Ettumanoor": (9.6748, 76.5592),
    "Vaikom": (9.7520, 76.3970),
    "Thuravoor": (9.8200, 76.3500),
    "Cherthala": (9.8816, 76.3388),
    "Ernakulam KSRTC": (9.9816, 76.2999),
    "Ernakulam": (9.9816, 76.2999),
    "Kumarakom Junction": (9.6230, 76.4280),
    "Kumarakom": (9.6230, 76.4280),
    "Kavalam": (9.5800, 76.4500),
    "Changanacherry": (9.4481, 76.5414),
    "Kanjikuzhy": (9.6200, 76.5600),
    "Pala": (9.7060, 76.6880),
    "Kuravilangad": (9.7983, 76.6197),
    "Erattupetta": (9.8830, 76.7810),
    "Mundakayam": (9.5166, 76.8500),
    "Ponkunnam": (9.6333, 76.8166),
    "Kanjirapally": (9.5500, 76.7833),
    "Muhamma": (9.6800, 76.3800),
    "Purakkad": (9.7500, 76.3500),
    "Alappuzha KSRTC": (9.4981, 76.3388),
    "Alappuzha": (9.4981, 76.3388),
    # Add more stops as needed
    "Kumaranalloor": (9.6050, 76.5400),
    "Samkranthi": (9.6150, 76.5480),
    "Adichira": (9.6250, 76.5500),
    "Caritas": (9.6350, 76.5530),
    "Thellakom": (9.6500, 76.5560),
    "101 Junction": (9.6620, 76.5575),
}

def get_stop_coords(stop_name: str):
    # Exact match first
    if stop_name in STOP_COORDS:
        return STOP_COORDS[stop_name]
    # Partial match
    lower = stop_name.lower()
    for key, val in STOP_COORDS.items():
        if lower in key.lower() or key.lower() in lower:
            return val
    return None

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def find_bus_segment(stops: list, bus_lat: float, bus_lng: float):
    """
    Returns (segment_index, label) where segment_index is the index of the
    last stop passed, and label describes position like 'Between Caritas and Thellakom'
    """
    if not stops:
        return 0, "Unknown"

    # Find closest stop
    min_dist = float('inf')
    closest_idx = 0
    for i, stop in enumerate(stops):
        coords = get_stop_coords(stop)
        if not coords:
            continue
        d = haversine(bus_lat, bus_lng, coords[0], coords[1])
        if d < min_dist:
            min_dist = d
            closest_idx = i

    # Check if bus is between two stops
    # If closest stop distance > 0.3km, it's between stops
    if min_dist > 0.3 and closest_idx < len(stops) - 1:
        prev_stop = stops[closest_idx]
        next_stop = stops[closest_idx + 1]
        # Check which direction: is bus closer to prev or next?
        next_coords = get_stop_coords(next_stop)
        if next_coords:
            d_next = haversine(bus_lat, bus_lng, next_coords[0], next_coords[1])
            if d_next < min_dist:
                # Bus is between closest_idx and closest_idx+1
                if closest_idx > 0:
                    label = f"Between {stops[closest_idx]} and {stops[closest_idx + 1]}"
                    return closest_idx, label
        label = f"Near {prev_stop}"
        return closest_idx, label

    if min_dist <= 0.3:
        return closest_idx, f"At {stops[closest_idx]}"

    return closest_idx, f"Near {stops[closest_idx]}"
