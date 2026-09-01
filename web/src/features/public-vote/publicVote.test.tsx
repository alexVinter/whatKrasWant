import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PublicInitiativeDetailPage } from '../../pages/public/PublicInitiativeDetailPage/PublicInitiativeDetailPage';

const configMock = vi.hoisted(() => ({
  votingEnabled: true,
}));

const sessionMock = vi.hoisted(() => ({
  authenticated: false,
}));

const mocks = vi.hoisted(() => ({
  obtainVkAccessToken: vi.fn(),
  loginWithVkAccessToken: vi.fn(),
  getPublicSession: vi.fn(),
  castVote: vi.fn(),
  getPublicIdeaDetail: vi.fn(),
}));

vi.mock('../../features/public-auth/vkSdk', () => ({
  obtainVkAccessToken: mocks.obtainVkAccessToken,
  initVkSdk: vi.fn(),
}));

vi.mock('../../features/public-auth/api', () => ({
  loginWithVkAccessToken: mocks.loginWithVkAccessToken,
  getPublicSession: mocks.getPublicSession,
  logoutPublic: vi.fn(),
}));

vi.mock('../../features/public-vote/api', () => ({
  castVote: mocks.castVote,
}));

vi.mock('../../features/public-config/queries', () => ({
  usePublicConfig: () => ({
    data: {
      districts: [],
      features: {
        PUBLIC_CATALOG: true,
        PUBLIC_SUBMISSION: false,
        VOTING: configMock.votingEnabled,
        RESULTS: false,
      },
      collectedIdeasCount: 3,
    },
    isLoading: false,
  }),
}));

vi.mock('../../features/public-ideas/queries', () => ({
  PUBLIC_IDEAS_KEY: ['public', 'ideas'],
  publicIdeaDetailKey: (slug: string) => ['public', 'ideas', 'detail', slug],
  usePublicIdeaDetail: () => ({
    data: mocks.getPublicIdeaDetail(),
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../../features/public-auth/usePublicAuth', () => ({
  PUBLIC_SESSION_QUERY_KEY: ['public', 'session'],
  usePublicSession: () => ({
    data: sessionMock.authenticated
      ? {
          authenticated: true,
          user: {
            id: 'u1',
            firstName: 'Ivan',
            lastName: 'Ivanov',
            avatarUrl: null,
          },
        }
      : { authenticated: false },
    isLoading: false,
  }),
  usePublicAuthActions: () => ({
    loginMutation: {
      mutateAsync: async () => {
        const token = await mocks.obtainVkAccessToken();
        return mocks.loginWithVkAccessToken(token);
      },
      isPending: false,
    },
  }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
    }),
  };
});

vi.mock('../../shared/map/IdeasMap', () => ({
  IdeasMap: () => <div data-testid="ideas-map" />,
}));

function renderDetail() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/initiatives/test-slug']}>
        <Routes>
          <Route
            path="/initiatives/:slug"
            element={<PublicInitiativeDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Public voting UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configMock.votingEnabled = true;
    sessionMock.authenticated = false;
    mocks.getPublicIdeaDetail.mockReturnValue({
      slug: 'test-slug',
      title: 'Test initiative',
      description: 'Description',
      authorName: 'Author',
      territory: 'City',
      address: null,
      latitude: null,
      longitude: null,
      publishedAt: '2026-08-10T00:00:00.000Z',
      voteCount: 0,
      hasVoted: false,
      image: null,
    });
    mocks.obtainVkAccessToken.mockRejectedValue(new Error('cancelled'));
    mocks.loginWithVkAccessToken.mockResolvedValue({
      user: { id: 'u1', firstName: 'Ivan', lastName: 'Ivanov', avatarUrl: null },
    });
    mocks.getPublicSession.mockResolvedValue({
      authenticated: true,
      user: { id: 'u1', firstName: 'Ivan', lastName: 'Ivanov', avatarUrl: null },
    });
    mocks.castVote.mockResolvedValue({
      voteId: 'vote-1',
      voteCount: 1,
      hasVoted: true,
    });
  });

  it('disables support when VOTING=false', () => {
    configMock.votingEnabled = false;
    renderDetail();
    expect(screen.getByRole('button', { name: 'Поддержать' })).toBeDisabled();
  });

  it('shows support button for authenticated user who has not voted', () => {
    sessionMock.authenticated = true;
    renderDetail();
    expect(screen.getByRole('button', { name: 'Поддержать' })).toBeEnabled();
  });

  it('starts VK flow when unauthenticated user clicks support', async () => {
    const user = userEvent.setup();
    mocks.obtainVkAccessToken.mockResolvedValue('vk-token');

    renderDetail();
    await user.click(screen.getByRole('button', { name: 'Поддержать' }));

    await waitFor(() => {
      expect(mocks.obtainVkAccessToken).toHaveBeenCalled();
      expect(mocks.loginWithVkAccessToken).toHaveBeenCalledWith('vk-token');
      expect(mocks.castVote).toHaveBeenCalledWith('test-slug');
    });
  });

  it('does not vote when VK login is cancelled', async () => {
    const user = userEvent.setup();
    mocks.obtainVkAccessToken.mockRejectedValue(new Error('cancelled'));
    renderDetail();
    await user.click(screen.getByRole('button', { name: 'Поддержать' }));
    await waitFor(() => {
      expect(mocks.castVote).not.toHaveBeenCalled();
    });
  });

  it('does not vote when VK login fails', async () => {
    const user = userEvent.setup();
    mocks.obtainVkAccessToken.mockResolvedValue('vk-token');
    mocks.loginWithVkAccessToken.mockRejectedValue(new Error('network'));
    renderDetail();
    await user.click(screen.getByRole('button', { name: 'Поддержать' }));
    await waitFor(() => {
      expect(mocks.castVote).not.toHaveBeenCalled();
    });
  });

  it('shows voted state and prevents repeat click', () => {
    sessionMock.authenticated = true;
    mocks.getPublicIdeaDetail.mockReturnValue({
      slug: 'test-slug',
      title: 'Test initiative',
      description: 'Description',
      authorName: 'Author',
      territory: 'City',
      address: null,
      latitude: null,
      longitude: null,
      publishedAt: '2026-08-10T00:00:00.000Z',
      voteCount: 2,
      hasVoted: true,
      image: null,
    });
    renderDetail();
    expect(screen.getByRole('button', { name: 'Вы поддержали' })).toBeDisabled();
  });

  it('calls vote API after authenticated click', async () => {
    const user = userEvent.setup();
    sessionMock.authenticated = true;
    renderDetail();
    await user.click(screen.getByRole('button', { name: 'Поддержать' }));
    await waitFor(() => {
      expect(mocks.castVote).toHaveBeenCalledWith('test-slug');
    });
  });
});
