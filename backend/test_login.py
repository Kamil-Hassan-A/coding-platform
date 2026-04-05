import requests
import json

url = "http://127.0.0.1:8000/auth/login"
payload = {
    "email": "candidate@example.com",
    "password": "Passw0rd!"
}

print(f"Testing login at {url}...")
try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")
