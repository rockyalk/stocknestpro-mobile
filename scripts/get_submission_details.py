import requests
import json

token = "TPdVWNBZqsZUyy6RHbfURQmQK0Dn-fYAouMs2usL"
project_id = "2cb6dfb5-1ff7-4565-b25e-528d05bfd1e9"
submission_id = "f6968896-0172-4890-a05b-c578ce124d39"

url = f"https://api.expo.dev/v2/projects/{project_id}/submissions/{submission_id}"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

res = requests.get(url, headers=headers)
print("Status Code:", res.status_code)
try:
    data = res.json()
    print(json.dumps(data, indent=2))
except Exception as e:
    print("Failed to parse JSON:", e)
    print("Response Text:", res.text[:1000])
