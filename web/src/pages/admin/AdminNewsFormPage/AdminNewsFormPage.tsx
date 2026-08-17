import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { IdeaImageField } from '../initiatives/IdeaImageField';
import { resolveImagePreview } from '../../../features/ideas/image';
import { useObjectUrl } from '../../../features/ideas/useObjectUrl';
import { uploadNewsImage } from '../../../features/news/api';
import {
  humanizeNewsError,
  humanizeNewsImageError,
} from '../../../features/news/errors';
import {
  EMPTY_NEWS_FORM,
  dateToInput,
  validateNewsForm,
  type NewsFormValues,
} from '../../../features/news/form';
import {
  useAdminNewsItem,
  useCreateNews,
  useNewsMutations,
} from '../../../features/news/queries';
import fieldStyles from '../initiatives/form.module.css';
import styles from './AdminNewsFormPage.module.css';

export function AdminNewsFormPage() {
  const { id } = useParams();
  const isCreate = !id || id === 'new';
  const newsId = isCreate ? undefined : id;
  const navigate = useNavigate();
  const location = useLocation();
  const query = useAdminNewsItem(newsId);
  const createMutation = useCreateNews();
  const mutations = useNewsMutations(newsId ?? '');

  const [values, setValues] = useState<NewsFormValues>(EMPTY_NEWS_FORM);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingRemove, setPendingRemove] = useState(false);
  const [error, setError] = useState<string | null>(
    (location.state as { imageUploadFailed?: boolean } | null)
      ?.imageUploadFailed
      ? 'Новость сохранена, но изображение загрузить не удалось.'
      : null,
  );
  const localPreviewUrl = useObjectUrl(pendingFile);

  const loadedId = query.data?.id;
  const loadedAt = query.data?.updatedAt;

  useEffect(() => {
    if (query.data) {
      setValues({
        title: query.data.title,
        body: query.data.body,
        publishDate: dateToInput(query.data.publishDate),
      });
      setPendingFile(null);
      setPendingRemove(false);
    }
  }, [loadedId, loadedAt, query.data]);

  const patch = (next: Partial<NewsFormValues>) => {
    setValues((current) => ({ ...current, ...next }));
    setError(null);
  };

  if (!isCreate && query.isLoading) {
    return <p className={styles.state}>Загрузка…</p>;
  }
  if (!isCreate && (query.isError || !query.data)) {
    return (
      <p className={styles.stateError} role="alert">
        Новость не найдена. Обновите страницу.
      </p>
    );
  }

  const detail = query.data;
  const previewUrl = pendingRemove
    ? localPreviewUrl
    : resolveImagePreview(localPreviewUrl, detail?.image?.url ?? null);
  const busy =
    createMutation.isPending ||
    mutations.save.isPending ||
    mutations.publish.isPending ||
    mutations.unpublish.isPending ||
    mutations.uploadImage.isPending ||
    mutations.deleteImage.isPending;

  const fieldsDirty =
    !isCreate &&
    detail &&
    (values.title !== detail.title ||
      values.body !== detail.body ||
      values.publishDate !== dateToInput(detail.publishDate));
  const imageDirty = Boolean(pendingFile) || pendingRemove;

  const persistImage = async (targetId: string) => {
    if (pendingFile) {
      if (isCreate) {
        await uploadNewsImage(targetId, pendingFile);
      } else {
        await mutations.uploadImage.mutateAsync(pendingFile);
      }
      setPendingFile(null);
      return;
    }
    if (pendingRemove && !isCreate) {
      await mutations.deleteImage.mutateAsync();
      setPendingRemove(false);
    }
  };

  const saveDraft = async () => {
    const validationError = validateNewsForm(values, false);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      if (isCreate) {
        const created = await createMutation.mutateAsync({
          action: 'DRAFT',
          title: values.title.trim(),
          body: values.body.trim(),
          publishDate: values.publishDate || null,
        });
        if (pendingFile) {
          try {
            await persistImage(created.id);
          } catch {
            navigate(`/admin/news/${created.id}`, {
              state: { imageUploadFailed: true },
            });
            return;
          }
        }
        navigate(`/admin/news/${created.id}`);
        return;
      }
      if (fieldsDirty) {
        await mutations.save.mutateAsync({
          title: values.title.trim(),
          body: values.body.trim(),
          publishDate: values.publishDate || null,
        });
      }
      if (imageDirty) {
        await persistImage(newsId!);
      }
    } catch (mutationError) {
      setError(
        imageDirty && !fieldsDirty
          ? humanizeNewsImageError(mutationError)
          : humanizeNewsError(mutationError),
      );
    }
  };

  const publish = async () => {
    const validationError = validateNewsForm(values, true);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      if (isCreate) {
        const created = await createMutation.mutateAsync({
          action: 'PUBLISH',
          title: values.title.trim(),
          body: values.body.trim(),
          publishDate: values.publishDate,
        });
        if (pendingFile) {
          try {
            await persistImage(created.id);
          } catch {
            navigate(`/admin/news/${created.id}`, {
              state: { imageUploadFailed: true },
            });
            return;
          }
        }
        navigate(`/admin/news/${created.id}`);
        return;
      }
      if (fieldsDirty) {
        await mutations.save.mutateAsync({
          title: values.title.trim(),
          body: values.body.trim(),
          publishDate: values.publishDate,
        });
      }
      if (imageDirty) {
        await persistImage(newsId!);
      }
      await mutations.publish.mutateAsync();
    } catch (mutationError) {
      setError(humanizeNewsError(mutationError));
    }
  };

  const unpublish = async () => {
    try {
      await mutations.unpublish.mutateAsync();
    } catch (mutationError) {
      setError(humanizeNewsError(mutationError));
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.titleDesktop}>Редактирование новости</h1>
        <h1 className={styles.titleMobile}>Новость</h1>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.columns}>
        <section className={styles.card}>
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label} htmlFor="newsTitle">
              <span className={styles.labelDesktop}>Название новости</span>
              <span className={styles.labelMobile}>Название</span>
            </label>
            <input
              id="newsTitle"
              className={fieldStyles.input}
              value={values.title}
              maxLength={200}
              placeholder="Название новости"
              onChange={(event) => patch({ title: event.target.value })}
            />
          </div>
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label} htmlFor="newsDate">
              Дата публикации
            </label>
            <input
              id="newsDate"
              type="date"
              className={fieldStyles.input}
              value={values.publishDate}
              onChange={(event) => patch({ publishDate: event.target.value })}
            />
          </div>
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label} htmlFor="newsBody">
              Текст новости
            </label>
            <textarea
              id="newsBody"
              className={`${fieldStyles.textarea} ${styles.body}`}
              value={values.body}
              onChange={(event) => patch({ body: event.target.value })}
            />
          </div>
        </section>

        <section className={styles.card}>
          <IdeaImageField
            label="Изображение (необязательно)"
            previewUrl={previewUrl}
            fileName={pendingFile?.name}
            statusHint={
              pendingFile ? 'Новое изображение ещё не сохранено' : null
            }
            busy={busy}
            removeLabel={pendingFile || pendingRemove ? 'Убрать' : 'Удалить'}
            onSelect={(file) => {
              setPendingFile(file);
              setPendingRemove(false);
              setError(null);
            }}
            onRemove={() => {
              if (pendingFile) {
                setPendingFile(null);
                return;
              }
              setPendingRemove(true);
            }}
          />

          <div className={styles.actions}>
            {detail?.status === 'PUBLISHED' ? (
              <>
                <button
                  type="button"
                  className={styles.draftButton}
                  onClick={() => void saveDraft()}
                  disabled={busy || (!fieldsDirty && !imageDirty)}
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  className={styles.unpublishButton}
                  onClick={() => void unpublish()}
                  disabled={busy}
                >
                  Снять с публикации
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.draftButton}
                  onClick={() => void saveDraft()}
                  disabled={busy}
                >
                  Сохранить черновик
                </button>
                <button
                  type="button"
                  className={styles.publishButton}
                  onClick={() => void publish()}
                  disabled={busy}
                >
                  Опубликовать
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
