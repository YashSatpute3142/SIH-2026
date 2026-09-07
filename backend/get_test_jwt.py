import requests

BASE_URL = "http://localhost:8000"
DEMO_EMAIL = "demo.tester@example.com"
DEMO_PASSWORD = "DemoPassword123!"
DEMO_NAME = "Demo Tester"


def get_test_jwt() -> str:
    register_response = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD, "name": DEMO_NAME},
    )

    if register_response.status_code == 200:
        token = register_response.json()["token"]
        print("Demo account created.")
        return token

    if register_response.status_code == 409:
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
        )
        login_response.raise_for_status()
        token = login_response.json()["token"]
        print("Demo account already existed, logged in instead.")
        return token

    register_response.raise_for_status()


def run_sync_tests(token: str):
    headers = {"Authorization": f"Bearer {token}"}

    print("\n1. Status:")
    r = requests.get(f"{BASE_URL}/api/sync/status", headers=headers)
    print(r.status_code, r.json())

    print("\n2. Toggle offline:")
    r = requests.post(f"{BASE_URL}/api/sync/toggle-internet", headers=headers, json={"online": False})
    print(r.status_code, r.json())

    print("\n3. Trigger sync while offline (expect skipped_offline: True):")
    r = requests.post(f"{BASE_URL}/api/sync/trigger", headers=headers)
    print(r.status_code, r.json())

    print("\n4. Toggle back online:")
    r = requests.post(f"{BASE_URL}/api/sync/toggle-internet", headers=headers, json={"online": True})
    print(r.status_code, r.json())

    print("\n5. Trigger sync while online (expect any queued entries to flush):")
    r = requests.post(f"{BASE_URL}/api/sync/trigger", headers=headers)
    print(r.status_code, r.json())


if __name__ == "__main__":
    jwt_token = get_test_jwt()
    run_sync_tests(jwt_token)

