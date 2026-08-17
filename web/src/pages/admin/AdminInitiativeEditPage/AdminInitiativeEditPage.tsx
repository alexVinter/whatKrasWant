import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useAdminCategories,
  useAdminDistricts,
} from '../../../features/taxonomy/queries';
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
import { humanizeIdeaError } from '../../../features/ideas/errors';
import {
  PlaceSection,
  TerritorySection,
} from '../initiatives/IdeaFormSections';
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
  const idea = useIdea(id);
  const revisions = useIdeaRevisions(id);
  const categories = useAdminCategories();
  const districts = useAdminDistricts();
  const mutations = useIdeaMutations(id);

  const [values, setValues] = useState<IdeaFormValues>(EMPTY_IDEA_FORM);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadedId = idea.data?.id;
  const loadedAt = idea.data?.updatedAt;

  // Sync the form from the server on first load and after each successful
  // mutation (updatedAt changes) without clobbering in-progress edits.
  useEffect(() => {
    if (idea.data) {
      setValues(ideaToForm(idea.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId, loadedAt]);

  const patch = (next: Partial<IdeaFormValues>) => {
    setValues((current) => ({ ...current, ...next }));
    setError(null);
  };

  if (idea.isLoading) {
    return <p className={styles.state}>Загрузка…</p>;
  }
  if (idea.isError || !idea.data) {
    return (
      <p className={styles.stateError} role="alert">
        Инициатива не найдена. Обновите страницу.
      </p>
    );
  }

  const detail = idea.data;
  const activeCategories = (categories.data ?? []).filter((c) => c.isActive);
  const busy =
    mutations.save.isPending ||
    mutations.publish.isPending ||
    mutations.unpublish.isPending ||
    mutations.archive.isPending ||
    mutations.restore.isPending;

  const save = async () => {
    const validationError = validateIdeaForm(values, false);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      await mutations.save.mutateAsync(toUpdateInput(values, reason));
      setReason('');
    } catch (mutationError) {
      setError(humanizeIdeaError(mutationError));
    }
  };

  const runAction = async (
    action: 'publish' | 'unpublish' | 'archive' | 'restore',
  ) => {
    if (action === 'publish') {
      const validationError = validateIdeaForm(values, true);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    try {
      await mutations[action].mutateAsync();
    } catch (mutationError) {
      setError(humanizeIdeaError(mutationError));
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
          <div className={styles.grid2}>
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
              <label className={fieldStyles.label} htmlFor="categoryId">
                Категория
              </label>
              <select
                id="categoryId"
                className={fieldStyles.select}
                value={values.categoryId}
                onChange={(event) => patch({ categoryId: event.target.value })}
              >
                <option value="">Выберите категорию</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
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
