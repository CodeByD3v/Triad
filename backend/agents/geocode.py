import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "community-hero-app"


def reverse_geocode(lat: float, lng: float) -> str:
    fallback = f"{lat:.4f}, {lng:.4f}"

    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={"lat": lat, "lon": lng, "format": "json"},
            headers={"User-Agent": USER_AGENT},
            timeout=5,
        )
        resp.raise_for_status()

        address = resp.json().get("address", {})
        for field in ("suburb", "city_district", "neighbourhood", "county", "city"):
            value = address.get(field)
            if value:
                return value
    except Exception:
        pass

    return fallback
