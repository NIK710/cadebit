import boto3
from botocore.client import BaseClient
from botocore.config import Config


class ObjectStorageError(Exception):
    pass


class S3ObjectStore:
    def __init__(
        self,
        *,
        endpoint: str,
        region: str,
        bucket: str,
        access_key: str,
        secret_key: str,
        force_path_style: bool,
    ) -> None:
        addressing_style = "path" if force_path_style else "virtual"
        self._bucket = bucket
        self._client: BaseClient = boto3.client(
            "s3",
            endpoint_url=endpoint,
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(s3={"addressing_style": addressing_style}),
        )

    async def get_bytes(self, key: str) -> bytes:
        try:
            response = self._client.get_object(Bucket=self._bucket, Key=key)
            return response["Body"].read()
        except Exception as error:
            raise ObjectStorageError(
                "The stored material could not be read."
            ) from error
