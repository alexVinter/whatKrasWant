import { describe, expect, it, vi, beforeEach } from 'vitest';

const configInit = vi.fn();
const authLogin = vi.fn();
const authExchangeCode = vi.fn();

vi.mock('@vkid/sdk', () => ({
  Config: { init: configInit },
  ConfigAuthMode: {
    Redirect: 'redirect',
    InNewTab: 'new_tab',
    InNewWindow: 'new_window',
  },
  ConfigResponseMode: {
    Redirect: 'redirect',
    Callback: 'callback',
  },
  ConfigSource: { LOWCODE: 'lowcode' },
  Auth: {
    login: authLogin,
    exchangeCode: authExchangeCode,
  },
}));

describe('vkSdk', () => {
  beforeEach(() => {
    vi.resetModules();
    configInit.mockReset();
    authLogin.mockReset();
    authExchangeCode.mockReset();
    vi.stubEnv('VITE_VK_CLIENT_ID', '54746356');
    vi.stubEnv('VITE_VK_REDIRECT_URI', 'http://localhost:8080/auth-test');
  });

  it('initializes VK SDK with explicit InNewTab + Callback mode', async () => {
    const { initVkSdk } = await import('./vkSdk');
    initVkSdk();

    expect(configInit).toHaveBeenCalledWith({
      app: 54746356,
      redirectUrl: 'http://localhost:8080/auth-test',
      mode: 'new_tab',
      responseMode: 'callback',
      source: 'lowcode',
    });
  });

  it('falls back redirect URL to current /auth-test origin', async () => {
    vi.stubEnv('VITE_VK_REDIRECT_URI', '');
    const { getVkRedirectUrl } = await import('./vkSdk');
    expect(getVkRedirectUrl()).toBe(`${window.location.origin}/auth-test`);
  });

  it('runs login → exchangeCode → access_token chain', async () => {
    authLogin.mockResolvedValue({ code: 'auth-code', device_id: 'device-1' });
    authExchangeCode.mockResolvedValue({ access_token: 'vk-access-token' });

    const { obtainVkAccessToken } = await import('./vkSdk');
    await expect(obtainVkAccessToken()).resolves.toBe('vk-access-token');

    expect(authLogin).toHaveBeenCalledTimes(1);
    expect(authExchangeCode).toHaveBeenCalledWith('auth-code', 'device-1');
  });
});
