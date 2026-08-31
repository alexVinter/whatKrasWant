import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PublicAuthTestPage } from '../../pages/public/PublicAuthTestPage/PublicAuthTestPage';

const mocks = vi.hoisted(() => ({
  obtainVkAccessToken: vi.fn(),
  loginWithVkAccessToken: vi.fn(),
  getPublicSession: vi.fn(),
  logoutPublic: vi.fn(),
  initVkSdk: vi.fn(),
}));

vi.mock('../../features/public-auth/vkSdk', () => ({
  initVkSdk: mocks.initVkSdk,
  obtainVkAccessToken: mocks.obtainVkAccessToken,
}));

vi.mock('../../features/public-auth/api', () => ({
  loginWithVkAccessToken: mocks.loginWithVkAccessToken,
  getPublicSession: mocks.getPublicSession,
  logoutPublic: mocks.logoutPublic,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PublicAuthTestPage />
    </QueryClientProvider>,
  );
}

describe('public auth feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublicSession.mockResolvedValue({ authenticated: false });
  });

  it('initializes VK SDK on auth test page', async () => {
    renderPage();
    await waitFor(() => {
      expect(mocks.initVkSdk).toHaveBeenCalledTimes(1);
    });
  });

  it('performs login flow through VK SDK and backend session', async () => {
    mocks.obtainVkAccessToken.mockResolvedValue('vk-access-token');
    mocks.loginWithVkAccessToken.mockResolvedValue({
      user: {
        id: 'user-1',
        firstName: 'Иван',
        lastName: 'Иванов',
        avatarUrl: null,
      },
    });

    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Войти через VK ID' }),
    );

    await waitFor(() => {
      expect(mocks.obtainVkAccessToken).toHaveBeenCalledTimes(1);
      expect(mocks.loginWithVkAccessToken).toHaveBeenCalledWith('vk-access-token');
    });

    expect(await screen.findByText('Иван Иванов')).toBeInTheDocument();
  });

  it('logs out and clears authenticated state', async () => {
    mocks.getPublicSession.mockResolvedValue({
      authenticated: true,
      user: {
        id: 'user-1',
        firstName: 'Иван',
        lastName: 'Иванов',
        avatarUrl: null,
      },
    });
    mocks.logoutPublic.mockResolvedValue({ success: true });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Выйти' }));

    await waitFor(() => {
      expect(mocks.logoutPublic).toHaveBeenCalledTimes(1);
    });
  });

  it('shows login error when VK SDK fails', async () => {
    mocks.obtainVkAccessToken.mockRejectedValue(new Error('VK login cancelled'));

    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Войти через VK ID' }),
    );

    expect(await screen.findByText('VK login cancelled')).toBeInTheDocument();
  });
});
