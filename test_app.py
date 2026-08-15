import pyotp
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import AdminUser
from app.config import SESSION_COOKIE_NAME, TOTP_PENDING_COOKIE_NAME

client = TestClient(app)

def test_full_flow():
    print("[1] Testing public homepage /")
    res = client.get("/")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    assert "rifemotion" in res.text
    print(" -> Homepage OK!")

    print("[2] Testing admin login page GET /admin/login")
    res = client.get("/admin/login")
    assert res.status_code == 200
    assert "rifemotion admin" in res.text
    print(" -> Login GET OK!")

    print("[3] Testing admin login with invalid password")
    res = client.post("/admin/login", data={"username": "testadmin", "password": "wrongpassword"})
    assert res.status_code == 400
    assert "Неверное имя пользователя или пароль" in res.text
    print(" -> Invalid login rejected OK!")

    print("[4] Testing admin login with valid credentials (first time -> 2FA setup)")
    res = client.post("/admin/login", data={"username": "testadmin", "password": "testpassword123"}, follow_redirects=False)
    assert res.status_code == 302
    assert "/admin/setup-2fa" in res.headers["location"]
    pending_cookie = res.cookies.get(TOTP_PENDING_COOKIE_NAME)
    assert pending_cookie is not None
    print(" -> Redirect to setup-2fa OK!")

    print("[5] Testing GET /admin/setup-2fa")
    client.cookies.set(TOTP_PENDING_COOKIE_NAME, pending_cookie)
    res = client.get("/admin/setup-2fa")
    assert res.status_code == 200
    assert "data:image/png;base64," in res.text
    print(" -> 2FA Setup QR code rendered OK!")

    # Extract secret from response or DB
    db = SessionLocal()
    user = db.query(AdminUser).filter(AdminUser.username == "testadmin").first()
    db.close()
    
    # Generate secret and test submitting
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    print(f"[6] Testing POST /admin/setup-2fa with valid code {valid_code}")
    res = client.post(
        "/admin/setup-2fa",
        data={"secret": secret, "totp_code": valid_code},
        follow_redirects=False
    )
    assert res.status_code == 302
    assert "/admin/dashboard" in res.headers["location"]
    session_cookie = res.cookies.get(SESSION_COOKIE_NAME)
    assert session_cookie is not None
    print(" -> 2FA activated & session issued OK!")

    print("[7] Testing GET /admin/dashboard with active session")
    client.cookies.set(SESSION_COOKIE_NAME, session_cookie)
    res = client.get("/admin/dashboard")
    assert res.status_code == 200
    assert "Hello World, testadmin!" in res.text
    assert "Журнал безопасности" in res.text
    print(" -> Dashboard Hello World OK!")

    print("[8] Testing second login attempt (2FA verify stage)")
    client.cookies.clear()
    res = client.post("/admin/login", data={"username": "testadmin", "password": "testpassword123"}, follow_redirects=False)
    assert res.status_code == 302
    assert "/admin/2fa" in res.headers["location"]
    pending_cookie = res.cookies.get(TOTP_PENDING_COOKIE_NAME)
    assert pending_cookie is not None
    print(" -> Redirect to 2FA verify OK!")

    print("[9] Testing POST /admin/2fa verification")
    client.cookies.set(TOTP_PENDING_COOKIE_NAME, pending_cookie)
    valid_code2 = pyotp.TOTP(secret).now()
    res = client.post("/admin/2fa", data={"totp_code": valid_code2}, follow_redirects=False)
    assert res.status_code == 302
    assert "/admin/dashboard" in res.headers["location"]
    print(" -> 2FA login verification OK!")

    print("\n==========================================")
    print(" ALL BACKEND AND 2FA TESTS PASSED 100%! ")
    print("==========================================")

if __name__ == "__main__":
    test_full_flow()
