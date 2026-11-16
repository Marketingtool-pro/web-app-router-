"""
f/tools/cron-sync-platforms — Meta Ads -> Supabase, every 10 minutes.

Rewritten 2026-11-16. The previous version:
  * synced ONE shared admin token (f/tools/fb_ads_access_token, old app 1582682256320433,
    de-authorised) instead of each customer's own connected account;
  * wrote columns that do not exist in campaign_metrics / daily_summary / sync_logs, so
    every insert was rejected;
  * swallowed every error and returned success:true with zero rows.
campaign_metrics therefore stopped at 2026-03-19.

This version follows the owner's final flow: each customer's own token from ad_accounts,
the real Meta Marketing API, real columns, and an honest per-account result in sync_logs.
Nothing is invented: an account whose token is rejected is logged as an error, not skipped.
"""
import datetime as dt
import requests
import wmill

GRAPH = "https://graph.facebook.com/v21.0"
CONVERSION_TYPES = {"purchase", "lead", "complete_registration", "app_install",
                    "offsite_conversion.fb_pixel_purchase", "onsite_web_purchase"}


def _sb():
    url = (wmill.get_variable("f/tools/supabase_url") or "").rstrip("/")
    key = wmill.get_variable("f/tools/supabase_service_key")
    return url, {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _graph(path, token, params):
    r = requests.get(f"{GRAPH}/{path}", params={"access_token": token, **params}, timeout=30)
    body = r.json() if r.content else {}
    if r.status_code != 200 or "error" in body:
        err = body.get("error") or {}
        raise RuntimeError(f"Meta {r.status_code}: {err.get('message') or r.text[:200]}")
    return body


def _paged(path, token, params, limit_pages=20):
    out, body = [], _graph(path, token, params)
    for _ in range(limit_pages):
        out.extend(body.get("data", []))
        nxt = (body.get("paging") or {}).get("next")
        if not nxt:
            break
        r = requests.get(nxt, timeout=30)
        body = r.json()
        if "error" in body:
            raise RuntimeError(f"Meta paging: {body['error'].get('message')}")
    return out


def _num(v, cast=float):
    try:
        return cast(float(v))
    except (TypeError, ValueError):
        return cast(0)


def _metric_rows(ad_account_uuid, insights):
    rows = []
    for i in insights:
        spend = _num(i.get("spend"))
        conversions = sum(_num(a.get("value"), int) for a in i.get("actions", []) or []
                          if a.get("action_type") in CONVERSION_TYPES)
        revenue = sum(_num(a.get("value")) for a in i.get("action_values", []) or []
                      if a.get("action_type") in CONVERSION_TYPES)
        rows.append({
            "ad_account_id": ad_account_uuid,
            "campaign_id": i.get("campaign_id"),
            "campaign_name": i.get("campaign_name"),
            "date": i.get("date_start"),
            "impressions": _num(i.get("impressions"), int),
            "clicks": _num(i.get("clicks"), int),
            "spend": spend,
            "conversions": conversions,
            "revenue": revenue,
            "ctr": _num(i.get("ctr")),
            "cpc": _num(i.get("cpc")),
            "roas": round(revenue / spend, 4) if spend else 0,
        })
    return [r for r in rows if r["campaign_id"] and r["date"]]


def main(dry_run: bool = False, days: int = 7):
    sb_url, h = _sb()
    accounts = requests.get(f"{sb_url}/rest/v1/ad_accounts", headers=h, timeout=20, params={
        "select": "id,user_id,account_id,access_token",
        "platform": "eq.meta", "is_active": "eq.true",
    })
    accounts.raise_for_status()
    accounts = accounts.json()

    until = dt.date.today()
    since = until - dt.timedelta(days=max(1, days) - 1)
    summary = {"accounts": len(accounts), "synced": 0, "failed": 0, "skipped": 0,
               "metric_rows": 0, "errors": {}, "dry_run": dry_run}

    for acct in accounts:
        started = dt.datetime.utcnow().isoformat() + "Z"
        meta_id = (acct.get("account_id") or "").strip()
        token = acct.get("access_token") or ""
        if not meta_id.startswith("act_") or not token:
            summary["skipped"] += 1
            status, n, err = "skipped", 0, "account_id is not a Meta act_ id or token missing"
        else:
            try:
                insights = _paged(f"{meta_id}/insights", token, {
                    "level": "campaign", "time_increment": 1,
                    "time_range": f'{{"since":"{since}","until":"{until}"}}',
                    "fields": "campaign_id,campaign_name,spend,clicks,impressions,ctr,cpc,actions,action_values",
                    "limit": 200,
                })
                rows = _metric_rows(acct["id"], insights)
                if rows and not dry_run:
                    w = requests.post(f"{sb_url}/rest/v1/campaign_metrics", timeout=30,
                                      params={"on_conflict": "ad_account_id,campaign_id,date"},
                                      headers={**h, "Prefer": "resolution=merge-duplicates,return=minimal"},
                                      json=rows)
                    if w.status_code >= 300:
                        raise RuntimeError(f"Supabase {w.status_code}: {w.text[:200]}")
                status, n, err = "success", len(rows), None
                summary["synced"] += 1
                summary["metric_rows"] += len(rows)
            except Exception as e:  # recorded, never hidden
                status, n, err = "error", 0, str(e)[:500]
                summary["failed"] += 1
                key = err[:90]
                summary["errors"][key] = summary["errors"].get(key, 0) + 1

        if not dry_run:
            requests.post(f"{sb_url}/rest/v1/sync_logs", timeout=10,
                          headers={**h, "Prefer": "return=minimal"},
                          json={"ad_account_id": acct["id"], "status": status, "records_synced": n,
                                "error_message": err, "started_at": started,
                                "completed_at": dt.datetime.utcnow().isoformat() + "Z"})

    summary["success"] = summary["failed"] == 0
    return summary
