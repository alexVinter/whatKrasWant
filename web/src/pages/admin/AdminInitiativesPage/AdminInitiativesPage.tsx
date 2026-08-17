import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAdminCategories,
  useAdminDistricts,
} from '../../../features/taxonomy/queries';
import { useIdeas } from '../../../features/ideas/queries';
import { STATUS_FILTER_OPTIONS, territoryLabel } from '../../../features/ideas/labels';
import type { IdeaListFilters, IdeaStatus } from '../../../features/ideas/types';
import { StatusBadge } from '../initiatives/StatusBadge';
import styles from './AdminInitiativesPage.module.css';

export function AdminInitiativesPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<IdeaListFilters>({});

  const ideas = useIdeas(filters);
  const categories = useAdminCategories();
  const districts = useAdminDistricts();

  const patch = (next: Partial<IdeaListFilters>) =>
    setFilters((current) => {
      const merged = { ...current, ...next };
      // Drop empty values so the query key stays clean.
      (Object.keys(merged) as (keyof IdeaListFilters)[]).forEach((key) => {
        if (merged[key] === '' || merged[key] === undefined) {
          delete merged[key];
        }
      });
      return merged;
    });

  const items = ideas.data?.items ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Инициативы</h1>
        <button
          type="button"
          className={styles.addButton}
          onClick={() => navigate('/admin/initiatives/new')}
        >
          <span className={styles.addLong}>Добавить инициативу</span>
          <span className={styles.addShort}>+ Добавить</span>
        </button>
      </div>

      <div className={styles.filters}>
        <input
          type="search"
          className={styles.search}
          placeholder="Поиск по названию"
          aria-label="Поиск по названию"
          value={filters.search ?? ''}
          onChange={(event) => patch({ search: event.target.value })}
        />
        <select
          className={styles.filterSelect}
          aria-label="Все статусы"
          value={filters.status ?? ''}
          onChange={(event) =>
            patch({ status: (event.target.value || undefined) as IdeaStatus })
          }
        >
          <option value="">Все статусы</option>
          {STATUS_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          aria-label="Все категории"
          value={filters.categoryId ?? ''}
          onChange={(event) => patch({ categoryId: event.target.value })}
        >
          <option value="">Все категории</option>
          {(categories.data ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          aria-label="Все территории"
          value={filters.territory ?? ''}
          onChange={(event) => patch({ territory: event.target.value })}
        >
          <option value="">Все территории</option>
          <option value="CITYWIDE">Весь город</option>
          {(districts.data ?? [])
            .filter((district) => district.isActive)
            .map((district) => (
              <option key={district.id} value={district.id}>
                {district.name} район
              </option>
            ))}
        </select>
      </div>

      <div className={styles.list}>
        <div className={styles.listHeader} aria-hidden="true">
          <span>Название / автор</span>
          <span>Категория</span>
          <span>Территория</span>
          <span>Статус</span>
          <span className={styles.actionsHead}>Действия</span>
        </div>

        {ideas.isLoading && <p className={styles.state}>Загрузка…</p>}
        {ideas.isError && (
          <p className={styles.stateError} role="alert">
            Не удалось загрузить инициативы. Обновите страницу.
          </p>
        )}
        {!ideas.isLoading && !ideas.isError && items.length === 0 && (
          <p className={styles.state}>Инициативы не найдены.</p>
        )}

        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.row}
            onClick={() => navigate(`/admin/initiatives/${item.id}`)}
          >
            <span className={styles.thumb} aria-hidden="true" />
            <span className={styles.cellTitle}>
              <span className={styles.rowTitle}>{item.title}</span>
              <span className={styles.rowAuthor}>
                Автор: {item.expertName ?? '—'}
              </span>
            </span>
            <span className={styles.cellCategory}>
              {item.category?.name ?? '—'}
            </span>
            <span className={styles.cellTerritory}>{territoryLabel(item)}</span>
            <span className={styles.cellStatus}>
              <StatusBadge status={item.status} />
            </span>
            <span className={styles.cellActions} aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </div>

      <p className={styles.footnote}>
        Категорию пользователь не выбирает — её назначает администратор.
      </p>
    </div>
  );
}
