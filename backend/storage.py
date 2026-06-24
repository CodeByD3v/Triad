import os
from uuid import uuid4

import boto3


class _UnavailableStorage:
    def __getattr__(self, name):
        raise RuntimeError(
            "AWS S3 is not configured. Set AWS_ACCESS_KEY_ID, "
            "AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_S3_BUCKET "
            "before using image uploads."
        )


AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET")

try:
    if not AWS_S3_BUCKET:
        raise RuntimeError("AWS_S3_BUCKET is not set")

    s3_client = boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )
except Exception:
    s3_client = _UnavailableStorage()


def upload_image(image_bytes: bytes, content_type: str | None = None) -> str:
    """
    Uploads image bytes to AWS S3 and returns the public URL.
    Public read access is granted via bucket policy (not ACL).
    """
    key = f"issues/{uuid4()}.jpg"
    put_kwargs: dict = {"Bucket": AWS_S3_BUCKET, "Key": key, "Body": image_bytes}
    if content_type:
        put_kwargs["ContentType"] = content_type

    s3_client.put_object(**put_kwargs)
    return f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"
