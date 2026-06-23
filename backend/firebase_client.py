import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore, storage


class _UnavailableFirebase:
    def __getattr__(self, name):
        raise RuntimeError(
            "Firebase is not configured locally. Provide serviceAccountKey.json "
            "or Application Default Credentials before using Firestore/Storage."
        )


_service_account_path = Path("serviceAccountKey.json")

try:
    if _service_account_path.exists():
        cred = credentials.Certificate(str(_service_account_path))
        firebase_admin.initialize_app(
            cred,
            {"storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET")},
        )
    else:
        firebase_admin.initialize_app(
            options={"storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET")}
        )

    db = firestore.client()
    bucket = storage.bucket()
except Exception:
    # Keep the API importable even when Firebase credentials are missing.
    db = _UnavailableFirebase()
    bucket = _UnavailableFirebase()
