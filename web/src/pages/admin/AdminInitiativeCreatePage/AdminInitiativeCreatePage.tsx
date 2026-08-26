import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminDistricts } from '../../../features/taxonomy/queries';
import { useAdminIdeaTopics } from '../../../features/idea-topics/queries';
import { useCreateIdea } from '../../../features/ideas/queries';
import { uploadIdeaImage } from '../../../features/ideas/api';
import {
  EMPTY_IDEA_FORM,
  toCreateInput,
  validateIdeaForm,
  type IdeaFormValues,
} from '../../../features/ideas/form';
import { humanizeIdeaError } from '../../../features/ideas/errors';
import {
  PlaceSection,
  TerritorySection,
} from '../initiatives/IdeaFormSections';
import { IdeaImageField } from '../initiatives/IdeaImageField';
import { useObjectUrl } from '../../../features/ideas/useObjectUrl';
import fieldStyles from '../initiatives/form.module.css';
import styles from './AdminInitiativeCreatePage.module.css';

export function AdminInitiativeCreatePage() {
  const navigate = useNavigate();
  const topics = useAdminIdeaTopics();
  const districts = useAdminDistricts();
  const createIdea = useCreateIdea();

  const [values, setValues] = useState<IdeaFormValues>(EMPTY_IDEA_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const previewUrl = useObjectUrl(imageFile);

  const patch = (next: Partial<IdeaFormValues>) => {
    setValues((current) => ({ ...current, ...next }));
    setError(null);
  };

  const submit = async (action: 'DRAFT' | 'PUBLISH') => {
    const validationError = validateIdeaForm(values);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      const created = await createIdea.mutateAsync(toCreateInput(values, action));
      if (imageFile) {
        setUploading(true);
        try {
          await uploadIdeaImage(created.id, imageFile);
        } catch {
          navigate(`/admin/initiatives/${created.id}`, {
            state: { imageUploadFailed: true },
          });
          return;
        } finally {
          setUploading(false);
        }
      }
      navigate(`/admin/initiatives/${created.id}`);
    } catch (mutationError) {
      setError(humanizeIdeaError(mutationError));
    }
  };

  const saving = createIdea.isPending || uploading;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Создание экспертной инициативы</h1>

      <div className={styles.columns}>
        <section className={styles.card}>
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label} htmlFor="expertName">
              Имя эксперта / автора
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
            <label className={fieldStyles.label} htmlFor="expertOrg">
              Организация
            </label>
            <input
              id="expertOrg"
              className={fieldStyles.input}
              value={values.expertOrg}
              maxLength={200}
              placeholder="Необязательно"
              onChange={(event) => patch({ expertOrg: event.target.value })}
            />
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

          <div className={fieldStyles.field}>
            <label className={fieldStyles.label} htmlFor="topicId">
              Тема идеи
            </label>
            <select
              id="topicId"
              className={fieldStyles.select}
              value={values.topicId}
              onChange={(event) => patch({ topicId: event.target.value })}
            >
              <option value="">Выберите тему</option>
              {(topics.data ?? []).map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </div>

          <TerritorySection
            values={values}
            districts={districts.data ?? []}
            onChange={patch}
          />
        </section>

        <section className={styles.card}>
          <PlaceSection values={values} onChange={patch} />

          <IdeaImageField
            previewUrl={previewUrl}
            fileName={imageFile?.name}
            busy={saving}
            removeLabel="Убрать"
            onSelect={(file) => {
              setImageFile(file);
              setError(null);
            }}
            onRemove={() => setImageFile(null)}
          />

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.draftButton}
              onClick={() => submit('DRAFT')}
              disabled={saving}
            >
              Сохранить черновик
            </button>
            <button
              type="button"
              className={styles.publishButton}
              onClick={() => submit('PUBLISH')}
              disabled={saving}
            >
              Опубликовать
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
