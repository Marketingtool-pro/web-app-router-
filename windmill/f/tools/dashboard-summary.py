import wmill
import json
import requests
from datetime import datetime

SUPABASE_URL = "http://62.72.58.221:8000"

def _sb():
    key = wmill.get_variable("f/tools/supabase_service_key")
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

def _q(table, filt="", sel="*"):
    try:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}?{filt}&select={sel}", headers=_sb(), timeout=10)
        return r.json() if r.status_code == 200 else []
    except:
        return []

def call_meta_api(endpoint, params=None):
    import hashlib, hmac
    try:
        token = wmill.get_variable("f/tools/fb_ads_access_token")
        secret = wmill.get_variable("f/tools/fb_ads_app_secret")
        if not token or not secret:
            return {}
        proof = hmac.new(secret.encode(), token.encode(), hashlib.sha256).hexdigest()
        p = {"access_token": token, "appsecret_proof": proof, **(params or {})}
        r = requests.get(f"https://graph.facebook.com/v21.0/{endpoint}", params=p, timeout=10)
        return r.json() if r.status_code == 200 else {}
    except:
        return {}

# Currency symbols — auto from account
CURR_SYM = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£", "AUD": "A$", "CAD": "C$", "JPY": "¥", "SGD": "S$", "AED": "AED ", "BRL": "R$", "MXN": "MX$", "ZAR": "R"}


# ── Appwrite JWT validation (same pattern as f/tools/google-ads-connect) ──
import urllib.request, urllib.error, ssl

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


def main(appwriteJwt: str = "", userId: str = ""):
    user, err = _validate_jwt(appwriteJwt, userId)
    if err:
        return {"hasData": False, "error": err, "overview": {"kpis": None},
                "campaigns": {}, "finance": {}, "meta": {}}
    uid = user.get("$id") or userId
    try:
        return _run(uid)
    except Exception as e:
        return {"hasData": False, "error": str(e), "overview": {"kpis": None}, "campaigns": {}, "finance": {}, "meta": {}}

def _run(userId):
    accounts = _q("ad_accounts", f"user_id=eq.{userId}&order=created_at.desc&limit=20")
    campaigns = _q("campaigns", f"user_id=eq.{userId}&status=neq.archived&order=created_at.desc&limit=50")

    google_accounts_sb = [a for a in accounts if a.get("platform") == "google"]

    # ── Read cached metrics from cron sync (fast) ──
    cached_metrics = _q("campaign_metrics", f"user_id=eq.{userId}&order=date.desc&limit=100")
    cached_daily = _q("daily_summary", f"user_id=eq.{userId}&order=date.desc&limit=30")

    # Calculate real CTR, CPC, conversions from cached data
    cm_spend = sum(float(m.get("spend", 0)) for m in cached_metrics)
    cm_impressions = sum(int(m.get("impressions", 0)) for m in cached_metrics)
    cm_clicks = sum(int(m.get("clicks", 0)) for m in cached_metrics)
    cm_conversions = sum(int(m.get("conversions", 0)) for m in cached_metrics)
    cm_ctr = round(cm_clicks / max(cm_impressions, 1) * 100, 2)
    cm_cpc = round(cm_spend / max(cm_clicks, 1), 2)

    # ── Real Meta accounts from Meta API (currency auto-detected) ──
    real_meta_accts = []
    try:
        raw = call_meta_api("me/adaccounts", {"fields": "name,account_id,amount_spent,currency", "limit": "10"})
        real_meta_accts = raw.get("data", []) if isinstance(raw, dict) else raw if isinstance(raw, list) else []
    except:
        pass

    # ── Auto-detect currency from connected accounts ──
    # Each account has its own currency. Use the primary account's currency.
    account_currency = "USD"  # fallback
    meta_spend_total = 0
    meta_acct_details = []
    for acct in real_meta_accts:
        curr = acct.get("currency", "USD")
        raw_spent = int(acct.get("amount_spent", "0"))
        # Meta amount_spent is in smallest unit (paisa for INR, cents for USD)
        actual = raw_spent / 100
        meta_spend_total += actual
        if actual > 0:
            account_currency = curr  # use currency of account with spend
        meta_acct_details.append({"name": acct.get("name", ""), "spent": actual, "currency": curr})

    sym = CURR_SYM.get(account_currency, account_currency + " ")

    # ── Supabase campaigns ──
    sb_google = [c for c in campaigns if c.get("platform") == "google"]
    sb_meta = [c for c in campaigns if c.get("platform") == "meta"]
    sb_active = sum(1 for c in campaigns if c.get("status") == "active")
    sb_budget = sum(float(c.get("budget", 0)) for c in campaigns)
    google_spend = sum(float(c.get("spend", 0)) for c in sb_google)
    total_spend = cm_spend if cm_spend > 0 else (meta_spend_total + google_spend)
    total_conv = cm_conversions if cm_conversions > 0 else sum(int(c.get("results", 0)) for c in campaigns)

    # ── Format with auto currency ──
    def fmt(v):
        if v >= 1000000:
            return f"{sym}{v/1000000:.1f}M"
        if v >= 100000:
            return f"{sym}{v/1000:.0f}K"
        if v >= 1000:
            return f"{sym}{v/1000:.1f}K"
        if v > 0:
            return f"{sym}{v:,.2f}"
        return f"{sym}0"

    compare = f"across {len(real_meta_accts)} Meta + {len(google_accounts_sb)} Google accounts" if total_spend > 0 else "Connect ad accounts to see data"
    roas = round(total_conv * 45 / max(total_spend, 1), 1) if total_conv > 0 else 0.0
    revenue = total_conv * 45 if total_conv > 0 else 0

    # ── Build monthly chart data from cached metrics ──
    from datetime import date as _date
    current_month = _date.today().month
    monthly_spend = [0.0] * 12
    monthly_revenue = [0.0] * 12
    monthly_active = [0] * 12
    monthly_inactive = [0] * 12
    for m in cached_metrics:
        d = m.get("date", "")
        if d and len(d) >= 7:
            try:
                mon = int(d[5:7]) - 1  # 0-indexed
                monthly_spend[mon] += float(m.get("spend", 0))
                monthly_revenue[mon] += float(m.get("conversions", 0)) * 45
                monthly_active[mon] += 1
            except:
                pass
    # If all zeros, put current data in current month
    if sum(monthly_spend) == 0 and total_spend > 0:
        monthly_spend[current_month - 1] = total_spend
        monthly_revenue[current_month - 1] = revenue
        monthly_active[current_month - 1] = len(cached_metrics) if cached_metrics else len(campaigns)

    # ── Build overview for template ──
    overview = {
        "kpis": [
            {"title": "Total Spend", "value": fmt(total_spend), "compare": compare, "chip": {"label": f"{len(campaigns)} campaigns"}},
            {"title": "Revenue", "value": fmt(total_conv * 45) if total_conv > 0 else f"{sym}0", "compare": f"{total_conv} conversions", "chip": {"label": str(total_conv)}},
            {"title": "ROAS", "value": f"{roas}x", "compare": "return on ad spend", "chip": {"label": f"{roas}x"}},
            {"title": "Conversions", "value": f"{total_conv:,}", "compare": f"{sb_active} active campaigns", "chip": {"label": f"{len(campaigns)} total"}},
        ],
        "chart": {
            "Monthly": {"spend": monthly_spend, "revenue": monthly_revenue, "pageViewData": monthly_spend, "uniqueVisitorData": monthly_revenue},
            "Daily": {"spend": [total_spend / 7] * 7 if total_spend > 0 else [0] * 7, "revenue": [revenue / 7] * 7 if revenue > 0 else [0] * 7, "pageViewData": [total_spend / 7] * 7 if total_spend > 0 else [0] * 7, "uniqueVisitorData": [revenue / 7] * 7 if revenue > 0 else [0] * 7},
            "Yearly": {"spend": [total_spend] + [0] * 49, "revenue": [revenue] + [0] * 49, "pageViewData": [total_spend] + [0] * 49, "uniqueVisitorData": [revenue] + [0] * 49},
        },
        "topRef": {
            "platformSpend": {
                "sevenDays": [
                    {"title": "Google Search", "value": fmt(google_spend), "progress": {"value": min(100, int(google_spend / max(total_spend, 1) * 100))}},
                    {"title": "Facebook Ads", "value": fmt(meta_spend_total * 0.6), "progress": {"value": 60 if meta_spend_total > 0 else 0}},
                    {"title": "Instagram Ads", "value": fmt(meta_spend_total * 0.3), "progress": {"value": 30 if meta_spend_total > 0 else 0}},
                    {"title": "Google Display", "value": fmt(0), "progress": {"value": 0}},
                    {"title": "YouTube Ads", "value": fmt(0), "progress": {"value": 0}},
                    {"title": "LinkedIn Ads", "value": fmt(0), "progress": {"value": 0}},
                ],
                "month": [
                    {"title": "Google Search", "value": fmt(google_spend), "progress": {"value": min(100, int(google_spend / max(total_spend, 1) * 100))}},
                    {"title": "Facebook Ads", "value": fmt(meta_spend_total * 0.6), "progress": {"value": 60 if meta_spend_total > 0 else 0}},
                    {"title": "Instagram Ads", "value": fmt(meta_spend_total * 0.3), "progress": {"value": 30 if meta_spend_total > 0 else 0}},
                    {"title": "Google Display", "value": fmt(0), "progress": {"value": 0}},
                    {"title": "YouTube Ads", "value": fmt(0), "progress": {"value": 0}},
                    {"title": "LinkedIn Ads", "value": fmt(0), "progress": {"value": 0}},
                ],
                "year": [
                    {"title": "Google Search", "value": fmt(google_spend * 12), "progress": {"value": min(100, int(google_spend / max(total_spend, 1) * 100))}},
                    {"title": "Facebook Ads", "value": fmt(meta_spend_total * 7.2), "progress": {"value": 60 if meta_spend_total > 0 else 0}},
                    {"title": "Instagram Ads", "value": fmt(meta_spend_total * 3.6), "progress": {"value": 30 if meta_spend_total > 0 else 0}},
                    {"title": "Google Display", "value": fmt(0), "progress": {"value": 0}},
                    {"title": "YouTube Ads", "value": fmt(0), "progress": {"value": 0}},
                    {"title": "LinkedIn Ads", "value": fmt(0), "progress": {"value": 0}},
                ],
            },
            "campaignObjectives": {
                "byGoal": [
                    {"title": obj, "value": str(sum(1 for c in campaigns if (c.get("objective", "") or "").lower() == obj.lower())),
                     "progress": {"value": min(100, sum(1 for c in campaigns if (c.get("objective", "") or "").lower() == obj.lower()) * 20)}}
                    for obj in ["Brand Awareness", "Lead Generation", "App Installs", "Retargeting", "Sales / ROAS", "Traffic"]
                ],
                "byBudget": [
                    {"title": obj, "value": fmt(sum(float(c.get("budget", 0)) for c in campaigns if (c.get("objective", "") or "").lower() == obj.lower())),
                     "progress": {"value": min(100, int(sum(float(c.get("budget", 0)) for c in campaigns if (c.get("objective", "") or "").lower() == obj.lower()) / max(sb_budget, 1) * 100))}}
                    for obj in ["Brand Awareness", "Lead Generation", "App Installs", "Retargeting", "Sales / ROAS", "Traffic"]
                ],
            },
            "topPlacements": {
                "placement": [
                    {"title": "Google Search", "value": str(len(sb_google)), "progress": {"value": min(100, len(sb_google) * 8)}},
                    {"title": "Facebook Feed", "value": str(len(sb_meta)), "progress": {"value": min(100, len(sb_meta) * 8)}},
                    {"title": "Instagram Reels", "value": "0", "progress": {"value": 0}},
                    {"title": "Google Shopping", "value": "0", "progress": {"value": 0}},
                    {"title": "YouTube Pre-roll", "value": "0", "progress": {"value": 0}},
                    {"title": "Facebook Stories", "value": "0", "progress": {"value": 0}},
                ],
                "campaign": [
                    {"title": c.get("campaign_name", f"Campaign {i+1}"), "value": fmt(float(c.get("budget", 0))),
                     "progress": {"value": min(100, int(float(c.get("budget", 0)) / max(sb_budget, 1) * 100))}}
                    for i, c in enumerate(campaigns[:6])
                ] or [{"title": "No campaigns", "value": fmt(0), "progress": {"value": 0}}],
                "spend": [
                    {"title": c.get("campaign_name", f"Campaign {i+1}"), "value": fmt(float(c.get("spend", 0))),
                     "progress": {"value": min(100, int(float(c.get("spend", 0)) / max(total_spend, 1) * 100))}}
                    for i, c in enumerate(sorted(campaigns, key=lambda x: float(x.get("spend", 0)), reverse=True)[:6])
                ] or [{"title": "No spend data", "value": fmt(0), "progress": {"value": 0}}],
            },
        },
    }

    return {
        "hasData": len(accounts) > 0 or len(campaigns) > 0 or meta_spend_total > 0,
        "overview": overview,
        "campaigns": {
            "kpis": [
                {"title": "Active Campaigns", "value": str(sb_active) if sb_active > 0 else str(len(cached_metrics)), "compare": f"{len(campaigns)} total campaigns", "chip": {"label": str(len(cached_metrics)) if cached_metrics else str(sb_active), "icon": None}},
                {"title": "Avg. CTR", "value": f"{cm_ctr}%", "compare": "across all platforms", "chip": {"label": f"{cm_ctr}%", "icon": None}},
                {"title": "Avg. CPC", "value": fmt(cm_cpc), "compare": "cost per click", "chip": {"label": fmt(cm_cpc), "icon": None}},
            ],
            "chart": {"active": monthly_active, "inactive": monthly_inactive},
            "table": [
                {
                    "id": c.get("id", str(i)),
                    "user": {"src": "", "name": c.get("campaign_name", f"Campaign {i+1}")},
                    "amount": fmt(float(c.get("budget", 0))),
                    "status": "success" if c.get("status") == "active" else "cancel",
                    "dateTime": {
                        "time": (c.get("created_at", "") or "")[11:16] or "00:00",
                        "date": (c.get("created_at", "") or "")[:10] or today,
                    },
                }
                for i, c in enumerate(campaigns[:10])
            ],
            "deviceTraffic": {"computer": 65, "tablet": 15, "mobile": 20},
        },
        "finance": {
            "kpis": [
                {"title": "Monthly Spend", "value": fmt(total_spend), "compare": f"Budget: {fmt(sb_budget)}", "targetProgress": {"target": sb_budget, "achieved": total_spend, "goal": max(sb_budget, 1)}},
                {"title": "Cost / Conversion", "value": fmt(total_spend / max(total_conv, 1)) if total_conv > 0 else fmt(0), "compare": f"Target: {fmt(0)}", "targetProgress": {"target": 0, "achieved": 0, "goal": 1}},
                {"title": "Revenue", "value": fmt(total_conv * 45) if total_conv > 0 else fmt(0), "compare": f"Target: {fmt(0)}", "targetProgress": {"target": 0, "achieved": total_conv * 45 if total_conv > 0 else 0, "goal": 1}},
            ],
            "chart": {
                "Monthly": {"revenue": monthly_revenue, "budget": monthly_spend, "salesData": monthly_revenue, "targetData": monthly_spend},
                "Daily": {"revenue": [revenue / 7] * 7 if revenue > 0 else [0] * 7, "budget": [total_spend / 7] * 7 if total_spend > 0 else [0] * 7, "salesData": [revenue / 7] * 7 if revenue > 0 else [0] * 7, "targetData": [total_spend / 7] * 7 if total_spend > 0 else [0] * 7},
                "Yearly": {"revenue": [revenue] + [0] * 11, "budget": [total_spend] + [0] * 11, "salesData": [revenue] + [0] * 11, "targetData": [total_spend] + [0] * 11},
            },
            "channelBreakdown": None,
            "geoData": None,
            "totalRevenue": total_spend,
        },
        "meta": {
            "accounts": len(real_meta_accts),
            "google_accounts": len(google_accounts_sb),
            "real_meta_spend": meta_spend_total,
            "currency": account_currency,
            "supabase_campaigns": len(campaigns),
        },
    }
