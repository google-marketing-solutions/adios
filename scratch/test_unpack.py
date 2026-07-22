from google.ads.googleads.client import GoogleAdsClient
from google.protobuf import any_pb2
from unittest.mock import patch, MagicMock

with patch("google.ads.googleads.oauth2.get_credentials", return_value=MagicMock()):
    g_client = GoogleAdsClient.load_from_dict({
        "developer_token": "mock_dev_token",
        "client_id": "mock_client_id",
        "client_secret": "mock_client_secret",
        "refresh_token": "mock_refresh_token",
        "use_proto_plus": True
    })

failure_msg = g_client.get_type("GoogleAdsFailure")
err1 = g_client.get_type("GoogleAdsError")
err1.message = "The request would cause a limit to be exceeded."
fpe1 = g_client.get_type("ErrorLocation.FieldPathElement")
fpe1.field_name = "operations"
fpe1.index = 0
err1.location.field_path_elements.append(fpe1)
failure_msg.errors.append(err1)

err2 = g_client.get_type("GoogleAdsError")
err2.message = "Marketing image asset is not enough."
fpe2 = g_client.get_type("ErrorLocation.FieldPathElement")
fpe2.field_name = "operations"
fpe2.index = 2
err2.location.field_path_elements.append(fpe2)
failure_msg.errors.append(err2)

real_bytes = failure_msg._pb.SerializeToString()

any_detail = any_pb2.Any()
any_detail.type_url = "type.googleapis.com/google.ads.googleads.v24.errors.GoogleAdsFailure"
any_detail.value = real_bytes

print("--- Testing correct extraction using FieldPathElement ---")
try:
    failure = g_client.get_type("GoogleAdsFailure")
    failure_pb = failure._pb if hasattr(failure, "_pb") else failure
    any_detail.Unpack(failure_pb)
    
    op_errors = {}
    for err in failure_pb.errors:
        op_idx = None
        if hasattr(err, "location") and err.location.field_path_elements:
            first_element = err.location.field_path_elements[0]
            if getattr(first_element, "field_name", "") == "operations" and hasattr(first_element, "index"):
                op_idx = first_element.index
                
        print(f"Extracted op_idx: {op_idx} | Message: {err.message}")
        if op_idx is not None and err.message:
            op_errors[op_idx] = err.message
            
    print(f"\nResulting op_errors: {op_errors}")
    assert 0 in op_errors
    assert 2 in op_errors
    print("SUCCESS: op_errors perfectly populated via FieldPathElement!")
except Exception as e:
    print(f"Failed: {e}")
