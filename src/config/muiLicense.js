import { LicenseInfo } from "@mui/x-license";

// MUI X Pro licence, v9 key, valid to 18 Mar 2027. Kept in source because
// MUI validates client-side, so the key is compiled into the bundle either
// way. It previously lived only in env vars that were never defined, so
// setLicenseKey never ran and every Pro component was watermarked.
const FALLBACK =
  "5722746adb1065ad9c64f47f2385d463" +
  "Tz0xMjcxOTcsRT0xODA1NTg3MTk5MDAwLFM9cHJvLExNPWFubnVhbCxQVj1RMS0yMDI2LFE9MSxLVj0y";

const MUI_X_LICENSE_KEY =
  import.meta.env.VITE_MUI_X_LICENSE_KEY ||
  import.meta.env.VITE_APP_MUI_X_LICENSE_KEY ||
  FALLBACK;

if (MUI_X_LICENSE_KEY) {
  LicenseInfo.setLicenseKey(MUI_X_LICENSE_KEY);
}
