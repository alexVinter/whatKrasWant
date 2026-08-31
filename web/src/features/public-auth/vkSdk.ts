import * as VKID from '@vkid/sdk';

let initialized = false;

/** Redirect URI registered in VK ID cabinet; must match Config.init redirectUrl. */
export function getVkRedirectUrl(): string {
  const configured = import.meta.env.VITE_VK_REDIRECT_URI?.trim();
  if (configured) {
    return configured;
  }
  return `${window.location.origin}/auth-test`;
}

export function initVkSdk(): void {
  if (initialized) {
    return;
  }

  const appId = import.meta.env.VITE_VK_CLIENT_ID?.trim();
  if (!appId) {
    throw new Error('VITE_VK_CLIENT_ID is not configured');
  }

  VKID.Config.init({
    app: Number(appId),
    redirectUrl: getVkRedirectUrl(),
    mode: VKID.ConfigAuthMode.InNewTab,
    responseMode: VKID.ConfigResponseMode.Callback,
    source: VKID.ConfigSource.LOWCODE,
  });

  initialized = true;
}

export async function obtainVkAccessToken(): Promise<string> {
  initVkSdk();

  const payload = (await VKID.Auth.login()) as {
    code: string;
    device_id: string;
  };
  const tokenResult = await VKID.Auth.exchangeCode(
    payload.code,
    payload.device_id,
  );

  if (!tokenResult.access_token) {
    throw new Error('VK ID did not return access_token');
  }

  return tokenResult.access_token;
}