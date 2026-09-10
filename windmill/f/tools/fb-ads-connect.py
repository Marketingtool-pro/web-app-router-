import wmill
import json
import hmac
import hashlib
import requests
import urllib.request
import urllib.error
import ssl
from datetime import datetime


# ── Appwrite JWT Validation ──
# Same pattern already used by f/tools/google-ads-connect. Without this the script
# trusted whatever userId it was handed and wrote ad_accounts rows for that user.
_AW_ENDPOINT = "https://api.marketingtool.pro/v1"
_AW_PROJECT = "6952c8a0002d3365625d"


def _validate_jwt(jwt_token, expected_uid=""):
    if not jwt_token:
        return None, "Authentication required"
    try:
        _ctx = ssl.create_default_context()
        _ctx.check_hostname = False
        _ctx.verify_mode = ssl.CERT_NONE
        _req = urllib.request.Request(
            f"{_AW_ENDPOINT}/account",
            headers={"X-Appwrite-Project": _AW_PROJECT, "X-Appwrite-JWT": jwt_token},
        )
        _resp = urllib.request.urlopen(_req, timeout=5, context=_ctx)
        user = json.loads(_resp.read().decode())
        if expected_uid and user.get("$id") != expected_uid:
            return None, "User ID mismatch"
        return user, None
    except urllib.error.HTTPError:
        return None, "Invalid or expired token"
    except Exception:
        return None, "Auth service unavailable"


def main(fbAccessToken: str = "", userId: str = "", appwriteJwt: str = ""):
    """Save Facebook/Meta ad account connection — fetches ALL ad accounts and saves each."""
    # Validate Appwrite JWT before trusting userId or writing anything.
    user, err = _validate_jwt(appwriteJwt, userId)
    if err:
        return {"success": False, "error": err}

    if not fbAccessToken or not userId:
        return {"success": False, "error": "fbAccessToken and userId required"}

    SUPABASE_URL = "http://62.72.58.221:8000"
    sb_key = wmill.get_variable("f/tools/supabase_service_key")
    try:
        app_secret = wmill.get_variable("f/tools/fb_ads_app_secret")
    except Exception:
        app_secret = ""

    headers = {
        "apikey": sb_key,
        "Authorization": f"Bearer {sb_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    now = datetime.utcnow().isoformat() + "Z"

    # Generate appsecret_proof if possible
    proof = ""
    if app_secret:
        proof = hmac.new(app_secret.encode(), fbAccessToken.encode(), hashlib.sha256).hexdigest()

    params = {"access_token": fbAccessToken, "fields": "id,name,email"}
    if proof:
        params["appsecret_proof"] = proof

    # Get user info
    user_name = ""
    try:
        r = requests.get("https://graph.facebook.com/v21.0/me", params=params, timeout=10)
        if r.status_code == 200:
            info = r.json()
            user_name = info.get("name", info.get("email", ""))
    except Exception:
        pass

    # Fetch ALL ad accounts this user has access to
    ad_params = {
        "access_token": fbAccessToken,
        "fields": "id,name,account_id,currency,account_status,business_name",
        "limit": 50,
    }
    if proof:
        ad_params["appsecret_proof"] = proof

    accounts = []
    try:
        r = requests.get("https://graph.facebook.com/v21.0/me/adaccounts", params=ad_params, timeout=15)
        if r.status_code == 200:
            accounts = r.json().get("data", [])
    except Exception:
        pass

    saved = 0
    for acct in accounts:
        acct_id = acct.get("id", "")
        acct_name = acct.get("name", acct.get("business_name", ""))
        currency = acct.get("currency", "USD")
        status = acct.get("account_status", 0)

        row = {
            "user_id": userId,
            "platform": "meta",
            "account_id": acct_id,
            "account_name": f"{acct_name} ({user_name})" if user_name else acct_name,
            "access_token": fbAccessToken,
            "refresh_token": "",
            "is_active": status in (1, 2),
            "created_at": now,
            "updated_at": now,
        }
        try:
            requests.post(f"{SUPABASE_URL}/rest/v1/ad_accounts", headers=headers, json=row, timeout=10)
            saved += 1
        except Exception:
            pass

    # If no ad accounts found, save with user ID
    if not accounts:
        row = {
            "user_id": userId,
            "platform": "meta",
            "account_id": f"fb_user_{userId[:8]}",
            "account_name": f"Meta Ads ({user_name})" if user_name else "Meta Ads",
            "access_token": fbAccessToken,
            "refresh_token": "",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        try:
            requests.post(f"{SUPABASE_URL}/rest/v1/ad_accounts", headers=headers, json=row, timeout=10)
            saved = 1
        except Exception:
            pass

    return {
        "success": True,
        "platform": "meta",
        "accounts_saved": saved,
        "total_accounts": len(accounts),
        "user_name": user_name,
    }
