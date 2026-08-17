import { useEffect, useRef, useState, type FormEvent } from 'react';
import { humanizeTaxonomyError } from '../../../features/taxonomy/errors';
import type { TaxonomyInput } from '../../../features/taxonomy/types';
import styles from './TaxonomyDialog.module.css';

export interface TaxonomyDialogProps {
  title: string;
  activeLabel: string;
  initialName: string;
  initialSortOrder: number | null;
  initialActive: boolean;
  submitLabel: string;
  onSubmit: (input: TaxonomyInput) => Promise<void>;
  onClose: () => void;
}

export function TaxonomyDialog({
  title,
  activeLabel,
  initialName,
  initialSortOrder,
  initialActive,
  submitLabel,
  onSubmit,
  onClose,
}: TaxonomyDialogProps) {
  const [name, setName] = useState(initialName);
  const [sortOrder, setSortOrder] = useState(
    initialSortOrder === null ? '' : String(initialSortOrder),
  );
  const [isActive, setIsActive] = useState(initialActive);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Введите название.');
      return;
    }

    const input: TaxonomyInput = { name: trimmed, isActive };
    const parsedOrder = Number.parseInt(sortOrder, 10);
    if (sortOrder.trim() !== '' && Number.isFinite(parsedOrder)) {
      input.sortOrder = parsedOrder;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(humanizeTaxonomyError(err));
      setSubmitting(false);
    }
  }

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="taxonomy-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="taxonomy-dialog-title" className={styles.title}>
          {title}
        </h2>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Название</span>
            <input
              ref={nameRef}
              className={styles.input}
              type="text"
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Порядок</span>
            <input
              className={styles.input}
              type="number"
              inputMode="numeric"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </label>

          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <span>{activeLabel}</span>
          </label>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancel}
              onClick={onClose}
              disabled={submitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className={styles.submit}
              disabled={submitting}
            >
              {submitting ? 'Сохранение…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
