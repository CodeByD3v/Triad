from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore


class _UnavailableFirebase:
    def __getattr__(self, name):
        raise RuntimeError(
            "Firebase is not configured. Provide serviceAccountKey.json "
            "or Application Default Credentials before using Firestore."
        )


_service_account_path = Path(__file__).with_name("serviceAccountKey.json")

try:
    if not firebase_admin._apps:
        if _service_account_path.exists():
            cred = credentials.Certificate(str(_service_account_path))
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()

    db = firestore.client()
except Exception:
    db = _UnavailableFirebase()
