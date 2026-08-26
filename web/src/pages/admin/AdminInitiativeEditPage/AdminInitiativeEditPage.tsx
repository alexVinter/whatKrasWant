import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useAdminDistricts } from '../../../features/taxonomy/queries';
import { useAdminIdeaTopics } from '../../../features/idea-topics/queries';
import {
  useIdea,
  useIdeaMutations,
  useIdeaRevisions,
} from '../../../features/ideas/queries';
import {
  EMPTY_IDEA_FORM,
  ideaToForm,
  toUpdateInput,
  validateIdeaForm,
  type IdeaFormValues,
} from '../../../features/ideas/form';
import { humanizeIdeaError, humanizeImageError } from '../../../features/ideas/errors';
import { resolveImagePreview } from '../../../features/ideas/image';
import { useObjectUrl } from '../../../features/ideas/useObjectUrl';
import {
  PlaceSection,
  TerritorySection,
} from '../initiatives/IdeaFormSections';
import { IdeaImageField } from '../initiatives/IdeaImageField';
import { StatusBadge } from '../initiatives/StatusBadge';
import fieldStyles from '../initiatives/form.module.css';
import styles from './AdminInitiativeEditPage.module.css';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminInitiativeEditPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const idea = useIdea(id);
  const revisions = useIdeaRevisions(id);
  const topics = useAdminIdeaTopics();
  const districts = useAdminDistricts();
  const mutations = useIdeaMutations(id);

  const [values, setValues] = useState<IdeaFormValues>(EMPTY_IDEA_FORM);
  const [dirty, setDirty] = useState(false);
  const [reason, setReason] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(
    (location.state as { imageUploadFailed?: boolean } | null)?.imageUploadFailed
      ? 'Инициатива сохранена, но изображение загрузить не удалось.'
      : null,
  );
  const localPreviewUrl = useObjectUrl(pendingFile);

  const loadedId = idea.data?.id;
  const loadedAt = idea.data?.updatedAt;

  // Sync from the server on first open and after successful server refresh,
  // but never clobber unsaved edits (e.g. topic change before Save/Publish).
  useEffect(() => {
    if (idea.data && !dirty) {
      setValues(ideaToForm(idea.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId, loadedAt]);

  const patch = (next: Partial<IdeaFormValues>) => {
    setValues((current) => ({ ...current, ...next }));
    setDirty(true);
    setError(null);
  };

  const detailOrNull = idea.data;
  const topicOptions = useMemo(() => {
    const items = topics.data ?? [];
    const current = detailOrNull?.topic;
    if (current && !items.some((topic) => topic.id === current.id)) {
      return [current, ...items];
    }
    return items;
  }, [topics.data, detailOrNull?.topic]);

  if (idea.isLoading) {
    return <p className={styles.state}>Загрузка…</p>;
  }
  if (idea.isError || !detailOrNull) {
    return (
      <p className={styles.stateError} role="alert">
        Инициатива не найдена. Обновите страницу.
      </p>
    );
  }

  const detail = detailOrNull;
  const previewUrl = resolveImagePreview(
    localPreviewUrl,
    detail.image?.url ?? null,
  );
  const busy =
    mutations.save.isPending ||
    mutations.publish.isPending ||
    mutations.unpublish.isPending ||
    mutations.archive.isPending ||
    mutations.restore.isPending ||
    mutations.uploadImage.isPending ||
    mutations.deleteImage.isPending;

  const persistPendingImage = async () => {
    if (!pendingFile) {
      return;
    }
    await mutations.uploadImage.mutateAsync(pendingFile);
    setPendingFile(null);
  };

  const persistForm = async () => {
    const validationError = validateIdeaForm(values);
    if (validationError) {
      setError(validationError);
      throw validationError;
    }
    await mutations.save.mutateAsync(toUpdateInput(values, reason));
    setReason('');
    setDirty(false);
  };

  const save = async () => {
    try {
      await persistForm();
    } catch (mutationError) {
      if (typeof mutationError === 'string') {
        return;
      }
      setError(humanizeIdeaError(mutationError));
      return;
    }
    try {
      await persistPendingImage();
    } catch (mutationError) {
      setError(humanizeImageError(mutationError));
    }
  };

  const runAction = async (
    action: 'publish' | 'unpublish' | 'archive' | 'restore',
  ) => {
    if (action === 'publish') {
      const validationError = validateIdeaForm(values);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    try {
      if (dirty) {
        await persistForm();
      }
      await persistPendingImage();
      await mutations[action].mutateAsync();
      setDirty(false);
    } catch (mutationError) {
      if (typeof mutationError === 'string') {
        return;
      }
      setError(
        pendingFile
          ? humanizeImageError(mutationError)
          : humanizeIdeaError(mutationError),
      );
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Карточка инициативы</h1>
        <StatusBadge status={detail.status} />
      </div>

      <div className={styles.columns}>
        <section className={styles.card}>
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label} htmlFor="expertName">
              Автор
            </label>
            <input
              id="expertName"
              className={fieldStyles.input}
              value={values.expertName}
              maxLength={200}
              onChange={(event) => patch({ expertName: event.target.value })}
            />
          </div>

          <div className={fieldStyles.field}>
            <label className={fieldStyles.label} htmlFor="topicId">
              Тема идеи
            </label>
            <select
              id="topicId"
              className={fieldStyles.select}
              value={values.topicId}
              disabled={busy}
              onChange={(event) => patch({ topicId: event.target.value })}
            >
              <option value="">Выберите тему</option>
              {topicOptions.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
            {topics.isError && (
              <p className={fieldStyles.hint} role="alert">
                Не удалось загрузить список тем. Обновите страницу.
              </p>
            )}
          </div>

          <div className={fieldStyles.field}>
            <label className={fieldStyles.label} htmlFor="title">
              Название
            </label>
            <input
              id="title"
              className={fieldStyles.input}
              value={values.title}
              maxLength={150}
              onChange={(event) => patch({ title: event.target.value })}
            />
          </div>

          <div className={fieldStyles.field}>
            <label className={fieldStyles.label} htmlFor="description">
              Описание
            </label>
            <textarea
              id="description"
              className={fieldStyles.textarea}
              value={values.description}
              maxLength={3000}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </div>

          <TerritorySection
            values={values}
            districts={districts.data ?? []}
            onChange={patch}
          />

          <PlaceSection values={values} onChange={patch} />

          <IdeaImageField
            previewUrl={previewUrl}
            fileName={pendingFile?.name}
            statusHint={
              pendingFile ? 'Новое изображение ещё не сохранено' : null
            }
            busy={busy}
            removeLabel={pendingFile ? 'Убрать' : 'Удалить'}
            onSelect={(file) => {
              setPendingFile(file);
              setError(null);
            }}
            onRemove={async () => {
              if (pendingFile) {
                setPendingFile(null);
                setError(null);
                return;
              }
              try {
                await mutations.deleteImage.mutateAsync();
              } catch (mutationError) {
                setError(humanizeImageError(mutationError));
              }
            }}
          />

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.saveButton}
              onClick={save}
              disabled={busy}
            >
              Сохранить
            </button>
            {detail.status === 'PUBLISHED' ? (
              <button
                type="button"
                className={styles.unpublishButton}
                onClick={() => runAction('unpublish')}
                disabled={busy}
              >
                Снять с публикации
              </button>
            ) : detail.status === 'ARCHIVED' ? (
              <button
                type="button"
                className={styles.restoreButton}
                onClick={() => runAction('restore')}
                disabled={busy}
              >
                Восстановить
              </button>
            ) : (
              <button
                type="button"
                className={styles.publishButton}
                onClick={() => runAction('publish')}
                disabled={busy}
              >
                Опубликовать
              </button>
            )}
            {detail.status !== 'ARCHIVED' && (
              <button
                type="button"
                className={styles.archiveButton}
                onClick={() => runAction('archive')}
                disabled={busy}
              >
                Архивировать
              </button>
            )}
          </div>
        </section>

        <section className={styles.sideCard}>
          <h2 className={styles.sideTitle}>История редакций</h2>

          {revisions.isLoading && <p className={styles.state}>Загрузка…</p>}
          {revisions.isError && (
            <p className={styles.stateError} role="alert">
              Не удалось загрузить историю.
            </p>
          )}
          {revisions.data && revisions.data.length === 0 && (
            <p className={styles.state}>История пуста.</p>
          )}

          <ol className={styles.timeline}>
            {(revisions.data ?? []).map((revision) => (
              <li key={revision.id} className={styles.timelineItem}>
                <span className={styles.timelineDot} aria-hidden="true" />
                <span className={styles.timelineReason}>
                  {revision.reason ?? 'Изменение'}
                </span>
                <span className={styles.timelineMeta}>
                  {revision.actor?.login ?? 'Администратор'} ·{' '}
                  {formatDateTime(revision.createdAt)}
                </span>
              </li>
            ))}
          </ol>

          <div className={fieldStyles.field}>
            <label className={fieldStyles.label} htmlFor="reason">
              Причина изменения
            </label>
            <textarea
              id="reason"
              className={fieldStyles.textarea}
              value={reason}
              maxLength={500}
              placeholder="Опишите, что изменили (необязательно)"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
