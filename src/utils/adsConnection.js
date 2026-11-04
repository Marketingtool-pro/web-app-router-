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
