import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loginWithFacebook, loginWithGoogle, replace } = vi.hoisted(() => ({
  loginWithFacebook: vi.fn(),
  loginWithGoogle: vi.fn(),
  replace: vi.fn()
}));

vi.mock('@/utils/api/auth', () => ({ loginWithFacebook, loginWithGoogle }));
vi.mock('@/utils/navigation', () => ({ useRouter: () => ({ replace }) }));

import AuthSocial from './AuthSocial';
import { APP_DEFAULT_PATH, AUTH_USER_KEY } from '@/config';

describe('AuthSocial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('offers Google and Facebook, not Instagram', () => {
    render(<AuthSocial />);
    expect(screen.getByRole('button', { name: /Sign in with Google/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in with Facebook/ })).toBeInTheDocument();
    expect(screen.queryByText(/Instagram/)).toBeNull();
  });

  it('starts the Facebook login and stores the user it returns', async () => {
    loginWithFacebook.mockResolvedValue({ data: { id: 'u1' }, error: null });
    render(<AuthSocial />);
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Facebook/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(APP_DEFAULT_PATH));
    expect(loginWithFacebook).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(AUTH_USER_KEY))).toEqual({ id: 'u1' });
  });

  it('shows a Facebook error given as a string', async () => {
    loginWithFacebook.mockResolvedValue({ data: null, error: 'Facebook said no' });
    render(<AuthSocial />);
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Facebook/ }));
    expect(await screen.findByText('Facebook said no')).toBeInTheDocument();
  });

  it('shows the message of a Facebook error object instead of [object Object]', async () => {
    loginWithFacebook.mockResolvedValue({ data: null, error: { message: 'Popup closed' } });
    render(<AuthSocial />);
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Facebook/ }));
    expect(await screen.findByText('Popup closed')).toBeInTheDocument();
  });

  it('starts the Google login', async () => {
    loginWithGoogle.mockResolvedValue({ data: null, error: null });
    render(<AuthSocial />);
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/ }));
    await waitFor(() => expect(loginWithGoogle).toHaveBeenCalledTimes(1));
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows the message of a Google error object', async () => {
    loginWithGoogle.mockResolvedValue({ data: null, error: { message: 'Google said no' } });
    render(<AuthSocial />);
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/ }));
    expect(await screen.findByText('Google said no')).toBeInTheDocument();
  });

  it('shows a generic error when the login call throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    loginWithFacebook.mockRejectedValue(new Error('network down'));
    render(<AuthSocial />);
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Facebook/ }));
    expect(await screen.findByText('Social login failed. Please try again.')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
