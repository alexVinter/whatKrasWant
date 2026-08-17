import { useId, useRef, useState } from 'react';
import { IMAGE_ACCEPT, validateImageFile } from '../../../features/ideas/image';
import styles from './form.module.css';

interface IdeaImageFieldProps {
  previewUrl: string | null;
  fileName?: string | null;
  statusHint?: string | null;
  busy?: boolean;
  label?: string;
  onSelect: (file: File) => void;
  onRemove: () => void;
  removeLabel: string;
}

export function IdeaImageField({
  previewUrl,
  fileName,
  statusHint = null,
  busy = false,
  label = 'Изображение инициативы',
  onSelect,
  onRemove,
  removeLabel,
}: IdeaImageFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const pick = (file: File | undefined) => {
    if (!file) {
      return;
    }
    const error = validateImageFile(file);
    if (error) {
      setLocalError(error);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      return;
    }
    setLocalError(null);
    onSelect(file);
  };

  return (
    <div className={styles.field}>
      <span className={styles.label} id={`${inputId}-label`}>
        {label}
      </span>
      <p className={styles.hint}>JPG или PNG, не больше 10 МБ. Одно изображение.</p>

      {previewUrl ? (
        <div className={styles.imagePreviewWrap}>
          <img
            className={styles.imagePreview}
            src={previewUrl}
            alt={label}
          />
          <div className={styles.imageActions}>
            <label className={styles.imageButton}>
              Заменить
              <input
                ref={inputRef}
                className={styles.fileInput}
                type="file"
                accept={IMAGE_ACCEPT}
                disabled={busy}
                aria-labelledby={`${inputId}-label`}
                onChange={(event) => {
                  pick(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
            <button
              type="button"
              className={styles.imageButtonDanger}
              onClick={onRemove}
              disabled={busy}
            >
              {removeLabel}
            </button>
          </div>
          {fileName && <span className={styles.hint}>{fileName}</span>}
          {statusHint && <span className={styles.hint}>{statusHint}</span>}
        </div>
      ) : (
        <label className={styles.imageDrop}>
          <span>Выберите JPG или PNG</span>
          <input
            ref={inputRef}
            className={styles.fileInput}
            type="file"
            accept={IMAGE_ACCEPT}
            disabled={busy}
            aria-labelledby={`${inputId}-label`}
            onChange={(event) => pick(event.target.files?.[0])}
          />
        </label>
      )}

      {localError && (
        <p className={styles.imageError} role="alert">
          {localError}
        </p>
      )}
    </div>
  );
}
