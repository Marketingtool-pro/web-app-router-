// localStorage flags set by the ads OAuth callbacks (fb-connect-callback,
// ig-connect-callback, google-ads-callback) and the Google Ads popup.
export const ADS_CONNECTED_KEYS = ['fb_ads_connected', 'google_ads_connected', 'ig_ads_connected'];

// True once ANY ad platform is connected. The hard Connect Ads modal stays up
// until this is true. It used to check only fb_ads_connected, so a user who
// connected Google Ads (or Instagram from Settings) got the modal back on every
// reload.
export function hasAnyAdsConnection(storage = window.localStorage) {
  return ADS_CONNECTED_KEYS.some((key) => storage.getItem(key) === 'true');
}

// Exchange a Google OAuth code on the server (f/tools/google-ads-connect) and mark
// Google Ads connected ONLY when the server confirms it saved the account. The
// script answers { success: true, account_name } or { success: false, error }.
// Every caller used to set the flag first and ignore the answer, so a failed
// exchange still closed the hard Connect Ads modal with nothing connected.
export async function connectGoogleAds({ code, redirectUri, userId, appwriteJwt, authJwt }, storage = window.localStorage) {
  const API_BASE = import.meta.env.VITE_WINDMILL_URL || 'https://app.marketingtool.pro';
  const API_WORKSPACE = import.meta.env.VITE_WINDMILL_WORKSPACE || 'marketingtool-pro';
  const res = await fetch(`${API_BASE}/api/w/${API_WORKSPACE}/jobs/run_wait_result/p/f/tools/google-ads-connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authJwt}` },
    body: JSON.stringify({ code, redirectUri, userId, appwriteJwt: appwriteJwt || '' })
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || result?.success !== true) {
    throw new Error(result?.error || `Server answered ${res.status}`);
  }
  storage.setItem('google_ads_connected', 'true');
  return result;
}

// Ask the server (Supabase ad_accounts via f/tools/fetch-connected-accounts)
// whether this user has any connected ad account. The browser flags alone are
// wrong for a customer who connected on another device or cleared site data.
// Returns true / false, or null when the server could not be asked.
export async function hasServerAdsConnection(userId, fetchAccounts) {
  if (!userId) return null;
  try {
    const res = await fetchAccounts({ userId });
    const accounts = Array.isArray(res) ? res : res?.accounts;
    if (!Array.isArray(accounts)) return null;
    return accounts.length > 0;
  } catch {
    return null;
  }
}
