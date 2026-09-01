import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SubmitIdeaCta } from './SubmitIdeaCta';
import { PublicSubmitPage } from '../../pages/public/PublicSubmitPage/PublicSubmitPage';
import {
  buildPublicSubmissionFormData,
  validatePublicSubmissionForm,
} from './form';
import { EMPTY_PUBLIC_SUBMISSION_FORM } from './types';

const mocks = vi.hoisted(() => ({
  obtainVkAccessToken: vi.fn(),
  loginWithVkAccessToken: vi.fn(),
  getPublicSession: vi.fn(),
  getPublicConfig: vi.fn(),
  getPublicIdeaTopics: vi.fn(),
  submitPublicIdea: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock('../public-auth/vkSdk', () => ({
  obtainVkAccessToken: mocks.obtainVkAccessToken,
  initVkSdk: vi.fn(),
}));

vi.mock('../public-auth/api', () => ({
  loginWithVkAccessToken: mocks.loginWithVkAccessToken,
  getPublicSession: mocks.getPublicSession,
  logoutPublic: vi.fn(),
}));

vi.mock('../public-config/queries', () => ({
  usePublicConfig: () => ({
    data: {
      districts: [],
      features: {
        PUBLIC_CATALOG: true,
        PUBLIC_SUBMISSION: true,
        VOTING: false,
        RESULTS: false,
      },
    },
    isLoading: false,
  }),
}));

vi.mock('../public-auth/usePublicAuth', () => ({
  PUBLIC_SESSION_QUERY_KEY: ['public', 'session'],
  usePublicSession: () => ({
    data: mocks.getPublicSession(),
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
  type UseQueryOptions = Parameters<typeof actual.useQuery>[0];
  return {
    ...actual,
    useQuery: (options: UseQueryOptions) => {
      if (
        options.queryKey[0] === 'public' &&
        options.queryKey[1] === 'idea-topics'
      ) {
        return actual.useQuery({
          ...options,
          queryFn: async () => [
            { id: 'topic-1', name: 'Благоустройство', slug: 'blag' },
          ],
        });
      }
      return actual.useQuery(options);
    },
    useMutation: actual.useMutation,
  };
});

vi.mock('./api', () => ({
  getPublicIdeaTopics: mocks.getPublicIdeaTopics,
  submitPublicIdea: mocks.submitPublicIdea,
}));

vi.mock('../../shared/map/IdeaGeoMapPicker', () => ({
  IdeaGeoMapPicker: ({
    onChange,
  }: {
    onChange: (patch: { latitude: string; longitude: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange({ latitude: '56.015300', longitude: '92.893200' })
      }
    >
      Set geo
    </button>
  ),
}));

function renderWithRouter(ui: React.ReactElement, initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<div>Home</div>} />
          <Route path="/submit" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('public submission flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublicSession.mockReturnValue({ authenticated: false });
    mocks.getPublicIdeaTopics.mockResolvedValue([
      { id: 'topic-1', name: 'Благоустройство', slug: 'blag' },
    ]);
  });

  it('navigates to /submit when authenticated CTA clicked', async () => {
    mocks.getPublicSession.mockReturnValue({
      authenticated: true,
      user: { id: 'u1', firstName: 'Иван', lastName: 'Иванов', avatarUrl: null },
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <SubmitIdeaCta />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Предложить идею' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/submit');
  });

  it('starts VK flow when unauthenticated CTA clicked', async () => {
    mocks.obtainVkAccessToken.mockResolvedValue('vk-token');
    mocks.loginWithVkAccessToken.mockResolvedValue({
      user: { id: 'u1', firstName: 'Иван', lastName: 'Иванов', avatarUrl: null },
    });
    mocks.getPublicSession.mockResolvedValue({
      authenticated: true,
      user: { id: 'u1', firstName: 'Иван', lastName: 'Иванов', avatarUrl: null },
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <SubmitIdeaCta />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Предложить идею' }));

    await waitFor(() => {
      expect(mocks.obtainVkAccessToken).toHaveBeenCalledTimes(1);
      expect(mocks.loginWithVkAccessToken).toHaveBeenCalledWith('vk-token');
      expect(mocks.navigate).toHaveBeenCalledWith('/submit');
    });
  });

  it('stays on page when VK login fails', async () => {
    mocks.obtainVkAccessToken.mockRejectedValue(new Error('cancelled'));

    render(
      <QueryClientProvider client={new QueryClient()}>
        <SubmitIdeaCta />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Предложить идею' }));
    await waitFor(() => {
      expect(mocks.navigate).not.toHaveBeenCalled();
    });
  });

  it('redirects unauthenticated /submit to home', async () => {
    renderWithRouter(<PublicSubmitPage />, '/submit');

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('shows form for authenticated /submit', async () => {
    mocks.getPublicSession.mockReturnValue({
      authenticated: true,
      user: { id: 'u1', firstName: 'Иван', lastName: 'Иванов', avatarUrl: null },
    });

    renderWithRouter(<PublicSubmitPage />, '/submit');

    expect(
      await screen.findByRole('heading', { name: 'Предложить идею' }),
    ).toBeInTheDocument();
  });

  it('validates required fields', () => {
    expect(validatePublicSubmissionForm(EMPTY_PUBLIC_SUBMISSION_FORM, null)).toBe(
      'Выберите тему идеи.',
    );
  });

  it('validates geo required', () => {
    expect(
      validatePublicSubmissionForm(
        {
          ...EMPTY_PUBLIC_SUBMISSION_FORM,
          topicId: 'topic-1',
          title: 'Достаточно длинное название инициативы',
          description:
            'Описание инициативы, достаточно длинное для прохождения валидации минимум пятьдесят символов.',
          address: 'Адрес',
        },
        null,
      ),
    ).toBe('Укажите геометку на карте.');
  });

  it('shows success state after submit', async () => {
    mocks.getPublicSession.mockReturnValue({
      authenticated: true,
      user: { id: 'u1', firstName: 'Иван', lastName: 'Иванов', avatarUrl: null },
    });
    mocks.submitPublicIdea.mockResolvedValue({
      id: 'idea-1',
      title: 'Test',
      status: 'MODERATION',
      submittedAt: new Date().toISOString(),
    });

    renderWithRouter(<PublicSubmitPage />, '/submit');

    await userEvent.selectOptions(
      await screen.findByLabelText('Тема идеи'),
      await screen.findByRole('option', { name: 'Благоустройство' }),
    );
    await userEvent.type(
      screen.getByLabelText('Название инициативы'),
      'Достаточно длинное название инициативы',
    );
    await userEvent.type(
      screen.getByLabelText('Описание инициативы'),
      'Описание инициативы, достаточно длинное для прохождения валидации минимум пятьдесят символов.',
    );
    await userEvent.type(screen.getByLabelText('Адрес / место'), 'Набережная');
    await userEvent.click(screen.getByRole('button', { name: 'Set geo' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Отправить на модерацию' }),
    );

    expect(
      await screen.findByText('Инициатива отправлена на модерацию'),
    ).toBeInTheDocument();
  });

  it('builds multipart payload with single image', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const formData = buildPublicSubmissionFormData(
      {
        topicId: 'topic-1',
        title: 'Достаточно длинное название инициативы',
        description:
          'Описание инициативы, достаточно длинное для прохождения валидации минимум пятьдесят символов.',
        address: 'Адрес',
        latitude: '56.015300',
        longitude: '92.893200',
      },
      file,
    );

    expect(formData.get('topicId')).toBe('topic-1');
    expect(formData.get('image')).toBeInstanceOf(File);
  });
});
