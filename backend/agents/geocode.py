import requests
import os

GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json"
MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")


def reverse_geocode(lat: float, lng: float) -> str:
    """
    Calls Google Geocoding API to get a human-readable ward/locality name.
    Falls back to coordinate string if API key is unavailable.
    """
    if not MAPS_API_KEY:
        return f"{lat:.4f}, {lng:.4f}"

    resp = requests.get(
        GEOCODING_URL,
        params={
            "latlng": f"{lat},{lng}",
            "key": MAPS_API_KEY,
            "result_type": "sublocality|locality",
            "language": "en",
        },
        timeout=5,
    )

    if resp.status_code == 200:
        results = resp.json().get("results", [])
        if results:
            return results[0].get(
                "formatted_address", f"{lat:.4f}, {lng:.4f}"
            )

    return f"{lat:.4f}, {lng:.4f}"
