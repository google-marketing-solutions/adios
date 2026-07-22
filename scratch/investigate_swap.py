import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from google.ads.googleads import client

print("--- Listing AssetFieldTypeEnum values ---")
client_config = {
    "developer_token": "dummy",
    "client_id": "dummy",
    "client_secret": "dummy",
    "refresh_token": "dummy",
    "use_proto_plus": True
}
c = client.GoogleAdsClient.load_from_dict(client_config)
for name, value in c.enums.AssetFieldTypeEnum.DESCRIPTOR.values_by_name.items():
    if "IMAGE" in name or "LOGO" in name:
        print(f"{name} = {value.number}")
sys.exit(0)
