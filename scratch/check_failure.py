import os
import sys

# Add the project root to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.core.firestore_service import default_firestore_service

def main():
    print("Fetching all Asset Group Links (Operations) ordered by timestamp descending...")
    docs = (
        default_firestore_service.client.collection("asset_group_links")
        .order_by("timestamp", direction="DESCENDING")
        .stream()
    )
    for doc in docs:
        data = doc.to_dict()
        print("-" * 50)
        print(f"ID: {doc.id}")
        print(f"Time: {data.get('timestamp')}")
        print(f"Customer ID: {data.get('customer_id')}")
        print(f"Asset Group: {data.get('asset_group_id')}")
        print(f"Asset ID: {data.get('google_ads_asset_id')}")
        print(f"Status: {data.get('status')}")
        print(f"Error: {data.get('error_message')}")

if __name__ == "__main__":
    main()
