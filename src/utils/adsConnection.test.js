import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ADS_CONNECTED_KEYS, hasAnyAdsConnection, hasServerAdsConnection } from './adsConnection';

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

describe('hasServerAdsConnection', () => {
  it('is true when the server returns at least one account', async () => {
    const fetchAccounts = vi.fn().mockResolvedValue({ success: true, accounts: [{ id: 'act_1' }] });
    await expect(hasServerAdsConnection('u1', fetchAccounts)).resolves.toBe(true);
    expect(fetchAccounts).toHaveBeenCalledWith({ userId: 'u1' });
  });

  it('accepts a bare array response', async () => {
    await expect(hasServerAdsConnection('u1', vi.fn().mockResolvedValue([{ id: 'x' }]))).resolves.toBe(true);
  });

  it('is false when the server returns no accounts', async () => {
    await expect(hasServerAdsConnection('u1', vi.fn().mockResolvedValue({ accounts: [] }))).resolves.toBe(false);
  });

  it('is null without a user, on an unexpected shape, or when the call fails', async () => {
    const fetchAccounts = vi.fn();
    await expect(hasServerAdsConnection('', fetchAccounts)).resolves.toBeNull();
    expect(fetchAccounts).not.toHaveBeenCalled();
    await expect(hasServerAdsConnection('u1', vi.fn().mockResolvedValue({ error: 'x' }))).resolves.toBeNull();
    await expect(hasServerAdsConnection('u1', vi.fn().mockRejectedValue(new Error('down')))).resolves.toBeNull();
  });
});
