import type { AdminDistrict } from '../../../features/taxonomy/types';
import type { IdeaFormValues } from '../../../features/ideas/form';
import type { TerritoryType } from '../../../features/ideas/types';
import { IdeaGeoMapPicker } from './IdeaGeoMapPicker';
import styles from './form.module.css';

interface TerritorySectionProps {
  values: IdeaFormValues;
  districts: AdminDistrict[];
  onChange: (patch: Partial<IdeaFormValues>) => void;
}

export function TerritorySection({
  values,
  districts,
  onChange,
}: TerritorySectionProps) {
  const activeDistricts = districts.filter((d) => d.isActive);

  const toggleDistrict = (id: string) => {
    const next = values.districtIds.includes(id)
      ? values.districtIds.filter((d) => d !== id)
      : [...values.districtIds, id];
    onChange({ districtIds: next });
  };

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor="territoryType">
        Территория
      </label>
      <select
        id="territoryType"
        className={styles.select}
        value={values.territoryType}
        onChange={(event) =>
          onChange({ territoryType: event.target.value as TerritoryType })
        }
      >
        <option value="CITYWIDE">Весь город</option>
        <option value="DISTRICTS">По районам</option>
      </select>

      {values.territoryType === 'DISTRICTS' && (
        <div className={styles.territory}>
          <span className={styles.hint}>Выберите один или несколько районов</span>
          <div className={styles.districtGrid}>
            {activeDistricts.map((district) => (
              <label key={district.id} className={styles.check}>
                <input
                  type="checkbox"
                  checked={values.districtIds.includes(district.id)}
                  onChange={() => toggleDistrict(district.id)}
                />
                {district.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface PlaceSectionProps {
  values: IdeaFormValues;
  onChange: (patch: Partial<IdeaFormValues>) => void;
}

export function PlaceSection({ values, onChange }: PlaceSectionProps) {
  return (
    <>
      <div className={styles.toggleRow}>
        <span className={styles.toggleLabel} id="specificPlaceLabel">
          Инициатива относится к конкретному месту
        </span>
        <label className={styles.toggleSwitch}>
          <input
            type="checkbox"
            role="switch"
            aria-labelledby="specificPlaceLabel"
            checked={values.hasSpecificPlace}
            onChange={(event) =>
              onChange({ hasSpecificPlace: event.target.checked })
            }
          />
          <span className={styles.toggleTrack} aria-hidden="true" />
        </label>
      </div>

      {values.hasSpecificPlace && (
        <>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="address">
              Адрес
            </label>
            <input
              id="address"
              className={styles.input}
              value={values.address}
              maxLength={300}
              placeholder="Введите адрес"
              onChange={(event) => onChange({ address: event.target.value })}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Геометка</span>
            <IdeaGeoMapPicker
              latitude={values.latitude}
              longitude={values.longitude}
              onChange={onChange}
            />
            <div className={styles.coords}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="latitude">
                  Широта
                </label>
                <input
                  id="latitude"
                  className={styles.input}
                  inputMode="decimal"
                  value={values.latitude}
                  placeholder="56.0106"
                  onChange={(event) =>
                    onChange({ latitude: event.target.value })
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="longitude">
                  Долгота
                </label>
                <input
                  id="longitude"
                  className={styles.input}
                  inputMode="decimal"
                  value={values.longitude}
                  placeholder="92.8526"
                  onChange={(event) =>
                    onChange({ longitude: event.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
