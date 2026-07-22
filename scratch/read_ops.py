import os
from src.core.auth_provider import _load_config_txt_env
_load_config_txt_env()

from src.core.firestore_service import default_firestore_service

ops = default_firestore_service.client.collection("asset_group_links").stream()
for doc in ops:
    d = doc.to_dict()
    print(f"{d.get('timestamp')} | {d.get('operation_type')} | {d.get('google_ads_asset_id')} | {d.get('asset_group_id')} | {d.get('status')} | {d.get('error_message')}")
