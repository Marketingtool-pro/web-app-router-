import { beforeEach, describe, expect, it } from 'vitest';

import { ADS_CONNECTED_KEYS, hasAnyAdsConnection } from './adsConnection';

describe('hasAnyAdsConnection', () => {
  beforeEach(() => localStorage.clear());

  it('is false when no ad platform is connected', () => {
    expect(hasAnyAdsConnection()).toBe(false);
  });

  it.each(ADS_CONNECTED_KEYS)('is true when only %s is set', (key) => {
    localStorage.setItem(key, 'true');
    expect(hasAnyAdsConnection()).toBe(true);
  });

  it('ignores values other than "true"', () => {
    ADS_CONNECTED_KEYS.forEach((key) => localStorage.setItem(key, 'false'));
    expect(hasAnyAdsConnection()).toBe(false);
  });
});
