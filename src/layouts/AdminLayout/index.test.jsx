import { act, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router-dom', () => ({ Outlet: () => null }));
vi.mock('./Drawer', () => ({ default: () => null }));
vi.mock('./Header', () => ({ default: () => null }));
vi.mock('@/components/Breadcrumbs', () => ({ default: () => null }));
vi.mock('@/components/Loader', () => ({ default: () => null }));
vi.mock('@/components/ConnectAdsModal', () => ({ default: () => <div>connect-ads-modal</div> }));
vi.mock('@/states/menu', () => ({ handlerDrawerOpen: vi.fn(), useGetMenuMaster: () => ({ menuMasterLoading: false }) }));
vi.mock('@/hooks/useConfig', () => ({ default: () => ({ state: { miniDrawer: true } }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'customer@example.com' } }) }));
const { fetchConnectedAccounts } = vi.hoisted(() => ({ fetchConnectedAccounts: vi.fn() }));
vi.mock('@/utils/api/windmill', () => ({ fetchConnectedAccounts }));

import AdminLayout from './index';

const render = (ui) => rtlRender(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

describe('AdminLayout Connect Ads modal', () => {
  beforeEach(() => {
    localStorage.clear();
    fetchConnectedAccounts.mockReset();
    fetchConnectedAccounts.mockResolvedValue({ success: true, accounts: [] });
  });

  it('shows the modal when no ad platform is connected', () => {
    render(<AdminLayout />);
    expect(screen.getByText('connect-ads-modal')).toBeInTheDocument();
  });

  it('does not show the modal after Google Ads is connected', () => {
    localStorage.setItem('google_ads_connected', 'true');
    render(<AdminLayout />);
    expect(screen.queryByText('connect-ads-modal')).toBeNull();
  });

  it('hides the modal when a connection lands while the page is open', () => {
    render(<AdminLayout />);
    localStorage.setItem('ig_ads_connected', 'true');
    act(() => window.dispatchEvent(new Event('focus')));
    expect(screen.queryByText('connect-ads-modal')).toBeNull();
  });

  it('hides the modal when the server has ad accounts but this browser has no flag', async () => {
    fetchConnectedAccounts.mockResolvedValue({ success: true, accounts: [{ id: 'act_1', platform: 'meta' }] });
    render(<AdminLayout />);
    await waitFor(() => expect(screen.queryByText('connect-ads-modal')).toBeNull());
    expect(fetchConnectedAccounts).toHaveBeenCalledWith({ userId: 'u1' });
  });

  it('does not re-show the modal when the server has no rows but the browser is connected', async () => {
    localStorage.setItem('fb_ads_connected', 'true');
    render(<AdminLayout />);
    await waitFor(() => expect(fetchConnectedAccounts).toHaveBeenCalled());
    expect(screen.queryByText('connect-ads-modal')).toBeNull();
  });

  it('keeps the browser answer when the server cannot be reached', async () => {
    localStorage.setItem('google_ads_connected', 'true');
    fetchConnectedAccounts.mockRejectedValue(new Error('down'));
    render(<AdminLayout />);
    await waitFor(() => expect(fetchConnectedAccounts).toHaveBeenCalled());
    expect(screen.queryByText('connect-ads-modal')).toBeNull();
  });
});
