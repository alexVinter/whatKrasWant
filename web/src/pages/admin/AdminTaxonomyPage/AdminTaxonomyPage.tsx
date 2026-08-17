import { useState, type ReactNode } from 'react';
import {
  useAdminCategories,
  useAdminDistricts,
  useCategoryMutations,
  useDistrictMutations,
} from '../../../features/taxonomy/queries';
import type {
  AdminCategory,
  AdminDistrict,
  TaxonomyInput,
} from '../../../features/taxonomy/types';
import { TaxonomyDialog } from './TaxonomyDialog';
import styles from './AdminTaxonomyPage.module.css';

type DialogState =
  | { kind: 'category'; mode: 'create' }
  | { kind: 'category'; mode: 'edit'; entity: AdminCategory }
  | { kind: 'district'; mode: 'create' }
  | { kind: 'district'; mode: 'edit'; entity: AdminDistrict };

interface SectionProps<T> {
  title: string;
  isLoading: boolean;
  isError: boolean;
  items: T[] | undefined;
  onAdd: () => void;
  listClassName: string;
  renderItem: (item: T) => ReactNode;
}

function Section<T extends { id: string }>({
  title,
  isLoading,
  isError,
  items,
  onAdd,
  listClassName,
  renderItem,
}: SectionProps<T>) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <button type="button" className={styles.addButton} onClick={onAdd}>
          Добавить
        </button>
      </div>

      {isLoading && <p className={styles.state}>Загрузка…</p>}
      {isError && (
        <p className={styles.stateError} role="alert">
          Не удалось загрузить данные. Обновите страницу.
        </p>
      )}
      {!isLoading && !isError && items && items.length === 0 && (
        <p className={styles.state}>Пока нет записей.</p>
      )}
      {!isLoading && !isError && items && items.length > 0 && (
        <div className={listClassName}>{items.map(renderItem)}</div>
      )}
    </section>
  );
}

export function AdminTaxonomyPage() {
  const categories = useAdminCategories();
  const districts = useAdminDistricts();
  const categoryMutations = useCategoryMutations();
  const districtMutations = useDistrictMutations();
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const closeDialog = () => setDialog(null);

  async function submitDialog(input: TaxonomyInput) {
    if (!dialog) {
      return;
    }
    if (dialog.kind === 'category') {
      if (dialog.mode === 'edit') {
        await categoryMutations.update.mutateAsync({
          id: dialog.entity.id,
          input,
        });
      } else {
        await categoryMutations.create.mutateAsync(input);
      }
    } else {
      if (dialog.mode === 'edit') {
        await districtMutations.update.mutateAsync({
          id: dialog.entity.id,
          input,
        });
      } else {
        await districtMutations.create.mutateAsync(input);
      }
    }
    closeDialog();
  }

  const dialogProps = dialog
    ? buildDialogProps(dialog)
    : null;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Категории и районы</h1>

      <div className={styles.columns}>
        <Section<AdminCategory>
          title="Категории"
          isLoading={categories.isLoading}
          isError={categories.isError}
          items={categories.data}
          onAdd={() => setDialog({ kind: 'category', mode: 'create' })}
          listClassName={styles.categoryList}
          renderItem={(category) => (
            <button
              key={category.id}
              type="button"
              className={styles.categoryRow}
              onClick={() =>
                setDialog({ kind: 'category', mode: 'edit', entity: category })
              }
            >
              <span className={styles.rowName}>{category.name}</span>
              <span
                className={`${styles.status} ${
                  category.isActive ? styles.statusActive : styles.statusInactive
                }`}
              >
                {category.isActive ? 'Активна' : 'Неактивна'}
              </span>
            </button>
          )}
        />

        <Section<AdminDistrict>
          title="Районы"
          isLoading={districts.isLoading}
          isError={districts.isError}
          items={districts.data}
          onAdd={() => setDialog({ kind: 'district', mode: 'create' })}
          listClassName={styles.districtList}
          renderItem={(district) => (
            <button
              key={district.id}
              type="button"
              className={`${styles.districtRow} ${
                district.isActive ? '' : styles.districtRowInactive
              }`}
              onClick={() =>
                setDialog({ kind: 'district', mode: 'edit', entity: district })
              }
            >
              <span className={styles.rowName}>{district.name}</span>
              <span
                className={`${styles.status} ${
                  district.isActive ? styles.statusActive : styles.statusInactive
                } ${styles.districtStatus}`}
              >
                {district.isActive ? 'Активен' : 'Неактивен'}
              </span>
            </button>
          )}
        />
      </div>

      {dialog && dialogProps && (
        <TaxonomyDialog
          key={`${dialog.kind}-${dialog.mode}-${
            dialog.mode === 'edit' ? dialog.entity.id : 'new'
          }`}
          title={dialogProps.title}
          activeLabel={dialogProps.activeLabel}
          initialName={dialogProps.initialName}
          initialSortOrder={dialogProps.initialSortOrder}
          initialActive={dialogProps.initialActive}
          submitLabel={dialogProps.submitLabel}
          onSubmit={submitDialog}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}

function buildDialogProps(dialog: DialogState) {
  const isCategory = dialog.kind === 'category';
  const activeLabel = isCategory ? 'Активна' : 'Активен';
  const submitLabel = dialog.mode === 'edit' ? 'Сохранить' : 'Добавить';

  if (dialog.mode === 'edit') {
    return {
      title: isCategory ? 'Категория' : 'Район',
      activeLabel,
      submitLabel,
      initialName: dialog.entity.name,
      initialSortOrder: dialog.entity.sortOrder,
      initialActive: dialog.entity.isActive,
    };
  }

  return {
    title: isCategory ? 'Новая категория' : 'Новый район',
    activeLabel,
    submitLabel,
    initialName: '',
    initialSortOrder: null as number | null,
    initialActive: true,
  };
}
