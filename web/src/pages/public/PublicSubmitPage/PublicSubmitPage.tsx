import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { usePublicConfig } from '../../../features/public-config/queries';
import { usePublicSession } from '../../../features/public-auth/usePublicAuth';
import { getPublicIdeaTopics, submitPublicIdea } from '../../../features/public-submission/api';
import {
  buildPublicSubmissionFormData,
  validatePublicSubmissionForm,
} from '../../../features/public-submission/form';
import { humanizeSubmissionError } from '../../../features/public-submission/errors';
import {
  EMPTY_PUBLIC_SUBMISSION_FORM,
  type PublicSubmissionFormValues,
} from '../../../features/public-submission/types';
import { IMAGE_ACCEPT } from '../../../features/ideas/image';
import { IdeaGeoMapPicker } from '../../../shared/map/IdeaGeoMapPicker';
import styles from './PublicSubmitPage.module.css';

export function PublicSubmitPage() {
  const navigate = useNavigate();
  const sessionQuery = usePublicSession();
  const configQuery = usePublicConfig();
  const topicsQuery = useQuery({
    queryKey: ['public', 'idea-topics'],
    queryFn: getPublicIdeaTopics,
    enabled:
      (configQuery.data?.features?.PUBLIC_SUBMISSION ?? false) &&
      sessionQuery.data?.authenticated === true,
  });

  const submissionEnabled = configQuery.data?.features?.PUBLIC_SUBMISSION ?? false;
  const [values, setValues] = useState<PublicSubmissionFormValues>(
    EMPTY_PUBLIC_SUBMISSION_FORM,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (sessionQuery.isLoading || configQuery.isLoading) {
      return;
    }
    if (!submissionEnabled || !sessionQuery.data?.authenticated) {
      navigate('/', { replace: true });
    }
  }, [
    sessionQuery.isLoading,
    sessionQuery.data?.authenticated,
    configQuery.isLoading,
    submissionEnabled,
    navigate,
  ]);

  const submitMutation = useMutation({
    mutationFn: (formData: FormData) => submitPublicIdea(formData),
    onSuccess: () => {
      setSubmitted(true);
      setFieldError(null);
    },
    onError: (error) => {
      setFieldError(humanizeSubmissionError(error));
    },
  });

  const loading = sessionQuery.isLoading || configQuery.isLoading;

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.loading} role="status">
          Загрузка…
        </p>
      </main>
    );
  }

  if (!submissionEnabled || !sessionQuery.data?.authenticated) {
    return null;
  }

  if (submitted) {
    return (
      <main className={styles.page}>
        <div className={styles.successCard}>
          <h1 className={styles.successTitle}>Инициатива отправлена на модерацию</h1>
          <p className={styles.successText}>
            После проверки инициатива может появиться на сайте.
          </p>
        </div>
      </main>
    );
  }

  const patch = (next: Partial<PublicSubmissionFormValues>) => {
    setValues((current) => ({ ...current, ...next }));
    setFieldError(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (submitMutation.isPending) {
      return;
    }

    const validationError = validatePublicSubmissionForm(values, imageFile);
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    submitMutation.mutate(buildPublicSubmissionFormData(values, imageFile));
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Предложить идею</h1>
      <p className={styles.lead}>
        Заполните форму. После отправки инициатива будет проверена модератором.
      </p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="submit-topic">
            Тема идеи
          </label>
          <select
            id="submit-topic"
            className={styles.select}
            value={values.topicId}
            onChange={(event) => patch({ topicId: event.target.value })}
            disabled={topicsQuery.isLoading || submitMutation.isPending}
            required
          >
            <option value="">Выберите тему</option>
            {(topicsQuery.data ?? []).map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="submit-title">
            Название инициативы
          </label>
          <input
            id="submit-title"
            className={styles.input}
            value={values.title}
            onChange={(event) => patch({ title: event.target.value })}
            disabled={submitMutation.isPending}
            maxLength={150}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="submit-description">
            Описание инициативы
          </label>
          <textarea
            id="submit-description"
            className={styles.textarea}
            value={values.description}
            onChange={(event) => patch({ description: event.target.value })}
            disabled={submitMutation.isPending}
            maxLength={3000}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="submit-address">
            Адрес / место
          </label>
          <input
            id="submit-address"
            className={styles.input}
            value={values.address}
            onChange={(event) => patch({ address: event.target.value })}
            disabled={submitMutation.isPending}
            maxLength={500}
            required
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Геометка на карте</span>
          <p className={styles.hint}>
            Нажмите на карту, чтобы указать место реализации идеи.
          </p>
          <IdeaGeoMapPicker
            latitude={values.latitude}
            longitude={values.longitude}
            onChange={(coords) => patch(coords)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="submit-image">
            Изображение
          </label>
          <p className={styles.hint}>Не более одного файла JPG или PNG до 10 МБ.</p>
          <input
            id="submit-image"
            type="file"
            className={styles.fileInput}
            accept={IMAGE_ACCEPT}
            disabled={submitMutation.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setImageFile(file);
              setFieldError(null);
            }}
          />
        </div>

        {fieldError ? (
          <p className={styles.error} role="alert">
            {fieldError}
          </p>
        ) : null}

        <button
          type="submit"
          className={styles.submitButton}
          disabled={submitMutation.isPending}
          aria-busy={submitMutation.isPending || undefined}
        >
          {submitMutation.isPending ? 'Отправка…' : 'Отправить на модерацию'}
        </button>
      </form>
    </main>
  );
}
