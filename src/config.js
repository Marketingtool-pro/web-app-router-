// @project
import { AuthType } from '@/enum';

/***************************  THEME CONSTANT  ***************************/

export const APP_DEFAULT_PATH = '/dashboard';
export const APP_SUPPORT_PATH = 'https://www.marketingtool.pro/help';

export const DRAWER_WIDTH = 260;
export const MINI_DRAWER_WIDTH = 76 + 1; // 1px - for right-side border

export const CSS_VAR_PREFIX = '';

/***************************  AUTH CONSTANT  ***************************/

// localStorage entry names (not secrets).
export const AUTH_USER_STORAGE = 'mt-auth-user';
export const AUTH_CONFIG_STORAGE = 'mt-auth-config';
export const AUTH_USER_KEY = AUTH_USER_STORAGE;
export const AUTH_CONFIG_KEY = AUTH_CONFIG_STORAGE;
export const AUTH_PROVIDER = AuthType.APPWRITE;
export const SOCIAL_AUTH_PROVIDER = 'appwrite';

/***************************  META APPS  ***************************/

// Ads Connect and login are TWO DIFFERENT Meta apps, both in business
// portfolio 1214819780123174 (confirmed by the owner and the Meta developer
// API on 2026-11-04):
//
//   2246709019441842  "marketingtool"      — ads connect (Facebook + Instagram
//                     ads popups), all webhooks to wm.marketingtool.pro
//   1830149205008066  "marketingtool pro"  — login only, via Appwrite
//
// This is the ads one. Appwrite OAuth handles login separately and must not use
// it. The old ads app 1582682256320433 sits in a different portfolio the owner
// no longer uses.
export const META_APP_ID = '2246709019441842';

/***************************  THEME ENUM  ***************************/

export let Themes;

(function (Themes) {
  Themes['THEME_CRM'] = 'crm';
  Themes['THEME_AI'] = 'ai';
  Themes['THEME_HOSTING'] = 'hosting';
})(Themes || (Themes = {}));

export let ThemeMode;

(function (ThemeMode) {
  ThemeMode['LIGHT'] = 'light';
  ThemeMode['DARK'] = 'dark';
  ThemeMode['SYSTEM'] = 'system';
})(ThemeMode || (ThemeMode = {}));

export let ThemeDirection;

(function (ThemeDirection) {
  ThemeDirection['LTR'] = 'ltr';
  ThemeDirection['RTL'] = 'rtl';
})(ThemeDirection || (ThemeDirection = {}));

export let ThemeI18n;

(function (ThemeI18n) {
  ThemeI18n['EN'] = 'en';
  ThemeI18n['FR'] = 'fr';
  ThemeI18n['RO'] = 'ro';
  ThemeI18n['ZH'] = 'zh';
})(ThemeI18n || (ThemeI18n = {}));

export let ThemeFonts;

(function (ThemeFonts) {
  ThemeFonts['FONT_ROBOTO'] = "'Roboto', sans-serif";
  ThemeFonts['FONT_SORA'] = "'Sora', sans-serif";
  ThemeFonts['FONT_FIGTREE'] = "'Figtree', sans-serif";
})(ThemeFonts || (ThemeFonts = {}));

export const defaultAuthConfig = {
  socialProvider: null
};
export const DEFAULT_THEME_MODE = ThemeMode.DARK;

/***************************  CONFIG  ***************************/

const config = {
  currentTheme: Themes.THEME_HOSTING,
  themeDirection: ThemeDirection.LTR,
  miniDrawer: false,
  i18n: ThemeI18n.EN
};

export default config;
