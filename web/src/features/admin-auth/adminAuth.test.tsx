import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installAuthFetchMock, renderApp } from '../../test/testUtils';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('admin auth flow', () => {
  it('shows the login form when there is no session', async () => {
    installAuthFetchMock({ initiallyLoggedIn: false });
    renderApp('/admin/login');

    expect(await screen.findByLabelText('Логин')).toBeInTheDocument();
    expect(screen.getByLabelText('Пароль')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
  });

  it('logs in successfully and navigates into the admin area', async () => {
    const fetchMock = installAuthFetchMock({ loginStatus: 200 });
    renderApp('/admin/login');

    await screen.findByLabelText('Логин');
    await userEvent.type(screen.getByLabelText('Логин'), 'admin');
    await userEvent.type(screen.getByLabelText('Пароль'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Обзор' }),
    ).toBeInTheDocument();

    const loginCall = fetchMock.calls.find((call) =>
      call.url.endsWith('/api/admin/auth/login'),
    );
    expect(loginCall).toBeDefined();
    expect(loginCall?.method).toBe('POST');
    expect(loginCall?.credentials).toBe('include');
  });

  it('stays on login and shows an error on 401', async () => {
    installAuthFetchMock({ loginStatus: 401 });
    renderApp('/admin/login');

    await screen.findByLabelText('Логин');
    await userEvent.type(screen.getByLabelText('Логин'), 'admin');
    await userEvent.type(screen.getByLabelText('Пароль'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Неверный логин или пароль',
    );
    expect(screen.getByLabelText('Логин')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Обзор' }),
    ).not.toBeInTheDocument();
  });

  it('redirects to login when opening /admin without a session', async () => {
    installAuthFetchMock({ initiallyLoggedIn: false });
    renderApp('/admin');

    expect(await screen.findByLabelText('Логин')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Обзор' }),
    ).not.toBeInTheDocument();
  });

  it('renders the admin layout and overview with a valid session', async () => {
    installAuthFetchMock({ initiallyLoggedIn: true });
    renderApp('/admin');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Обзор' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
  });

  it('logs out via the backend and returns to the login page', async () => {
    const fetchMock = installAuthFetchMock({ initiallyLoggedIn: true });
    renderApp('/admin');

    await screen.findByRole('heading', { level: 1, name: 'Обзор' });
    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }));

    expect(await screen.findByLabelText('Логин')).toBeInTheDocument();

    const logoutCall = fetchMock.calls.find((call) =>
      call.url.endsWith('/api/admin/auth/logout'),
    );
    expect(logoutCall).toBeDefined();
    expect(logoutCall?.method).toBe('POST');
    expect(logoutCall?.credentials).toBe('include');

    await waitFor(() => expect(fetchMock.isLoggedIn()).toBe(false));
  });
});
