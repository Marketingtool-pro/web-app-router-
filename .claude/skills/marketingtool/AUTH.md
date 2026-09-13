# Auth — the complete picture, tested on the live site 2026-09-13

Do not re-derive any of this. Every line was produced by clicking the real
button or calling the real endpoint, not by reading code.

## What the login page at app.marketingtool.pro/login actually does

| Button | Tested result |
|---|---|
| Sign in with Google | Reaches Google's real sign-in, "to continue to MarketingTool Pro". **Works.** |
| Sign in with Instagram | Prints `Missing required parameter: "provider"` on the page. **Never worked.** |
| Facebook | There is no button. |
| Email + password | Present, untested. |

## Why Instagram can never work

Appwrite has no Instagram OAuth provider. Requesting one returns:

```
HTTP 400  general_argument_invalid
Invalid `provider` param: Value must be one of (amazon, apple, auth0,
authentik, autodesk, bitbucket, bitly, box, dailymotion, discord, disqus,
dropbox, etsy, facebook, figma, github, gitlab, google, linkedin, microsoft,
notion, oidc, okta, paypal, paypalSandbox, podio, salesforce, slack, spotify,
stripe, tradeshift, tradeshiftBox, twitch, wordpress, yahoo, yammer, yandex,
zoho, zoom, mock)
```

Instagram is not in that list of 38. The fix is to use Facebook Login instead —
the @marketingtool.pro Instagram Business account is attached to the Facebook
Page, so it reaches the same identity. `src/sections/auth/AuthSocial.jsx` was
changed to do this on branch `worktree-meta-auth-fix`.

## Why Facebook login is dead

Appwrite's Facebook provider points at Meta app **1414526646867223**. Opening
that OAuth URL in a browser gives:

```
App not active
This app is not accessible right now and the app developer is aware of the issue.
```

That app is deactivated and is not in either portfolio. Appwrite also builds the
dialog with Graph API **v2.8**.

Probe any provider without guessing:

```
curl -sI "https://api.marketingtool.pro/v1/account/sessions/oauth2/<provider>\
?project=6952c8a0002d3365625d&success=https%3A%2F%2Fapp.marketingtool.pro%2F\
social-auth-callback&failure=https%3A%2F%2Fapp.marketingtool.pro%2Flogin" \
  | grep -i '^location:'
```

Results on 2026-09-13: google redirects correctly, apple redirects correctly,
facebook redirects to the dead app, instagram returns HTTP 400.

## Why the good Meta apps cannot host Facebook Login either

Both apps inside the verified portfolio answer:

```
Feature Unavailable
Facebook Login is currently unavailable for this app.
```

- 1582682256320433 MarketingTool Ads
- 1255201403175191 Marketingtool

The Facebook Login product has never been added to them. Adding it needs the App
Dashboard, and nobody can open them there, because the verified portfolio
`737035192427150` has **zero human members** — only the System users
`Ai marketingtool` (Admin, 61588618762204) and `Conversions API System User`.
System users cannot sign in to developers.facebook.com.

## The identity split that causes all of it

developers.facebook.com accepts only a **Facebook** login. The verified
portfolio is administered by an **Instagram** login, which Meta classifies as a
**WorkPlatform** managed account. Meta says so itself:

> you will be operating with your Facebook personal account, instead of your
> current WorkPlatform one

That WorkPlatform account can read the portfolio but cannot invite people
("You don't have permission to perform this action"), cannot open WhatsApp
Manager ("You don't have access"), and cannot claim an app it does not own.

## Fixing Appwrite's Facebook provider

It needs the `projects.write` scope. Proven by calling it unauthenticated:

```
PATCH /v1/projects/6952c8a0002d3365625d/oauth2
{"message":"User (role: guests) missing scopes ([\"projects.write\"])","code":401}
```

That scope is console-only. An Appwrite API key cannot do it, and the Appwrite
CLI on VPS1 is installed but has no session. It has to be done from the Appwrite
console at `api.marketingtool.pro/console`, under Auth then Settings then
Facebook, replacing the App ID and secret.

## What OAuth on app 2246709019441842 proved

Running the app's real ads-connect URL end to end returned a token whose
permissions were:

```
granted: ads_management, ads_read, business_management, catalog_management,
         email, instagram_basic, instagram_content_publish,
         instagram_manage_comments, instagram_manage_insights,
         leads_retrieval, pages_manage_ads, pages_manage_metadata,
         pages_read_engagement, pages_show_list, public_profile,
         read_insights, user_friends
declined: instagram_manage_messages, pages_messaging,
          pages_utility_messaging, whatsapp_business_management,
          whatsapp_business_messaging
```

`me/adaccounts` returned three real accounts, one with 7193 INR spent. So Meta
ads-connect genuinely works — but only for users holding a role on the app,
because that app's portfolio is unverified and every permission is capped at
Standard access.
