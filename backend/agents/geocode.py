import requests


def reverse_geocode(lat: float, lng: float) -> str:
    """
    Reverse geocodes coordinates to a human-readable locality name
    using Nominatim (OpenStreetMap) — free, no API key required.

    Priority order: suburb → city_district → neighbourhood → county → city
    Falls back to coordinate string if the request fails.
    """
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lng, "format": "json"},
            headers={"User-Agent": "community-hero-civic-app"},
            timeout=5,
        )
        if resp.status_code == 200:
            addr = resp.json().get("address", {})
            return (
                addr.get("suburb")
                or addr.get("city_district")
                or addr.get("neighbourhood")
                or addr.get("county")
                or addr.get("city")
                or addr.get("state_district")
                or f"{lat:.4f}, {lng:.4f}"
            )
    except Exception:
        pass

    return f"{lat:.4f}, {lng:.4f}"
