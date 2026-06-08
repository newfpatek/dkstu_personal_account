import { useState, useEffect } from 'react';
import { getScholarship } from '../../api/students';
import { formatDate } from '../../utils/date';
import s from './shared.module.css';
import styles from './ScholarshipPage.module.css';

const SCHOLARSHIP_LABELS = {
  academic: 'Академическая',
  social: 'Социальная',
  enhanced_academic: 'Повышенная академическая',
  academic_coeff_1_4: 'Академическая (коэф. 1.4)',
  academic_coeff_1_5: 'Академическая (коэф. 1.5)',
  enhanced_social: 'Повышенная социальная',
};

const DIRECTION_LABELS = {
  academic: 'Учебная деятельность',
  research: 'Научная деятельность',
  social: 'Общественная деятельность',
  sports: 'Спортивная деятельность',
  cultural: 'Культурная деятельность',
};

function formatAmount(amount) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function ScholarshipPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getScholarship()
      .then((res) => setData(res.data))
      .catch(() => setError('Не удалось загрузить данные о стипендии'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className={s.empty}>Загрузка...</p>;
  if (error) return <p className={s.errorMsg}>{error}</p>;

  const { isPaid, scholarships } = data;

  return (
    <div>
      <h1 className={s.pageTitle}>Стипендия</h1>

      {isPaid && (
        <div className={styles.infoBox}>
          <span className={styles.infoIcon}>ℹ</span>
          <p>Вы обучаетесь на платной основе — начисление стипендии не предусмотрено.</p>
        </div>
      )}

      {!isPaid && scholarships.length === 0 && (
        <div className={styles.emptyBox}>
          <p>На данный момент стипендия не назначена.</p>
        </div>
      )}

      {!isPaid && scholarships.length > 0 && (
        <div className={styles.cards}>
          {scholarships.map((sc) => (
            <div key={sc.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.cardType}>
                  {SCHOLARSHIP_LABELS[sc.type] || sc.type}
                </span>
                {sc.direction && (
                  <span className={styles.cardDirection}>
                    {DIRECTION_LABELS[sc.direction] || sc.direction}
                  </span>
                )}
              </div>

              <div className={styles.cardAmount}>{formatAmount(sc.amount)}</div>

              <div className={styles.cardMeta}>
                <span>с {formatDate(sc.periodStart)}</span>
                {sc.periodEnd && <span> по {formatDate(sc.periodEnd)}</span>}
              </div>

              <div className={styles.cardStatus}>
                <span
                  className={styles.statusDot}
                  style={{ background: sc.isActive ? '#16a34a' : '#9ca3af' }}
                />
                {sc.isActive ? 'Активна' : 'Завершена'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}