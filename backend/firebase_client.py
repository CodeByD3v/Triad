import firebase_admin
from firebase_admin import credentials, firestore, storage
import os

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred, {
    "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET")
})

db = firestore.client()
bucket = storage.bucket()
