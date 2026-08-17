/* eslint-disable react-refresh/only-export-components -- test utility module, not subject to fast refresh */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { AppRouter } from '../app/router/AppRouter';

export interface FetchCall {
  url: string;
  method: string;
  credentials?: RequestCredentials;
  body?: string;
}

export interface FetchMock {
  mock: ReturnType<typeof vi.fn>;
  calls: FetchCall[];
  isLoggedIn: () => boolean;
}

function jsonResponse(body: unknown, status: number): Response {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Response(payload, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Installs a stateful fetch mock for the admin auth endpoints.
 * The session endpoint reflects the current login state, which is toggled by
 * the login/logout endpoints — this mirrors the real server-session behavior.
 */
export function installAuthFetchMock(options?: {
  initiallyLoggedIn?: boolean;
  loginStatus?: number;
}): FetchMock {
  let loggedIn = options?.initiallyLoggedIn ?? false;
  const loginStatus = options?.loginStatus ?? 200;
  const admin = { id: 'a-1', login: 'admin', email: 'admin@example.com' };
  const calls: FetchCall[] = [];

  const mock = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({
        url,
        method,
        credentials: init?.credentials,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });

      if (url.endsWith('/api/admin/auth/session')) {
        return Promise.resolve(
          loggedIn ? jsonResponse({ admin }, 200) : jsonResponse(null, 401),
        );
      }

      if (url.endsWith('/api/admin/auth/login')) {
        if (loginStatus === 200) {
          loggedIn = true;
          return Promise.resolve(jsonResponse({ admin }, 200));
        }
        return Promise.resolve(
          jsonResponse({ message: 'Invalid credentials' }, loginStatus),
        );
      }

      if (url.endsWith('/api/admin/auth/logout')) {
        loggedIn = false;
        return Promise.resolve(jsonResponse({ success: true }, 200));
      }

      return Promise.resolve(jsonResponse(null, 404));
    },
  );

  vi.stubGlobal('fetch', mock);

  return { mock, calls, isLoggedIn: () => loggedIn };
}

function AppWithProviders({ initialEntry }: { initialEntry: string }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRouter />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

export function renderApp(initialEntry: string): void {
  render(<AppWithProviders initialEntry={initialEntry} />);
}
