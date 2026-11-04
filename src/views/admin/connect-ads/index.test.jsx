import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import ConnectAdsPage from './index';
import { META_APP_ID } from '@/config';

describe('ConnectAdsPage', () => {
  const realLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    navigate.mockClear();
    delete window.location;
    window.location = { origin: 'https://app.marketingtool.pro', href: '' };
  });

  afterEach(() => {
    window.location = realLocation;
  });

  it('uses the ads Meta app 2246709019441842', () => {
    expect(META_APP_ID).toBe('2246709019441842');
  });

  it('sends the user to the Facebook dialog of the ads app with the ads redirect', () => {
    render(<ConnectAdsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Continue with Facebook/ }));
    const url = new URL(window.location.href);
    expect(url.origin + url.pathname).toBe('https://www.facebook.com/v21.0/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe('2246709019441842');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.marketingtool.pro/oauth/facebook-ads');
    expect(url.searchParams.get('state')).toBe(sessionStorage.getItem('fb_ads_state'));
  });

  it('skips to the dashboard when Facebook ads are already connected', () => {
    localStorage.setItem('fb_ads_connected', 'true');
    render(<ConnectAdsPage />);
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });
});
