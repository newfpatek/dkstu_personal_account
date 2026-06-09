import { useState, useEffect } from 'react';
import { getAllGrades, getGradesHistory, getGpa, getDebts, getMyCurrentSemesterPlan } from '../../api/students';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/error';
import s from './shared.module.css';

const GRADE_LABELS = {
  excellent: 'Отлично',
  good: 'Хорошо',
  satisfactory: 'Удовлетворительно',
  unsatisfactory: 'Неудовлетворительно',
  passed: 'Зачтено',
  failed: 'Не зачтено',
  absent: 'Не явился',
  absent_exam: 'Не явился (экзамен)',
};

const GRADE_COLORS = {
  excellent: '#16a34a',
  good: '#2563eb',
  satisfactory: '#d97706',
  unsatisfactory: '#dc2626',
  passed: '#16a34a',
  failed: '#dc2626',
  absent: '#9ca3af',
  absent_exam: '#dc2626',
};

function GradeCell({ value }) {
  return (
    <span style={{ color: GRADE_COLORS[value] || 'inherit', fontWeight: 500 }}>
      {GRADE_LABELS[value] || value}
    </span>
  );
}

export default function GradesPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState('current');
  const [history, setHistory] = useState({});
  const [plan, setPlan] = useState(null);
  const [allGrades, setAllGrades] = useState([]);
  const [gpa, setGpa] = useState(null);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    Promise.all([getGradesHistory(), getGpa(), getDebts(), getMyCurrentSemesterPlan(), getAllGrades()])
      .then(([histRes, gpaRes, debtsRes, planRes, allRes]) => {
        setHistory(histRes.data);
        setGpa(gpaRes.data.gpa);
        setDebts(debtsRes.data);
        setPlan(planRes.data);
        setAllGrades(allRes.data);
      })
      .catch((err) => {
        showToast(getErrorMessage(err, 'Не удалось загрузить данные'));
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const hasPlan = plan && plan.entries && plan.entries.length > 0;

  const years = Object.keys(history).sort().reverse();

  if (loading) return <p className={s.empty}>Загрузка...</p>;
  if (loadError) return <p className={s.errorMsg}>Не удалось загрузить данные. Попробуйте обновить страницу.</p>;

  return (
    <div>
      <h1 className={s.pageTitle}>Зачётная книжка</h1>

      <div className={s.summaryRow}>
        <div className={s.summaryCard}>
          <span className={s.summaryLabel}>Средний балл</span>
          <span className={s.summaryValue}>{gpa !== null ? gpa.toFixed(2) : '—'}</span>
        </div>
        <div className={s.summaryCard}>
          <span className={s.summaryLabel}>Задолженности</span>
          <span
            className={s.summaryValue}
            style={{ color: debts.length > 0 ? '#dc2626' : '#16a34a' }}
          >
            {debts.length}
          </span>
        </div>
      </div>

      <div className={s.tabs}>
        <button
          className={`${s.tab} ${tab === 'current' ? s.activeTab : ''}`}
          onClick={() => setTab('current')}
        >
          Текущий семестр
        </button>
        <button
          className={`${s.tab} ${tab === 'all' ? s.activeTab : ''}`}
          onClick={() => setTab('all')}
        >
          Все оценки
        </button>
        <button
          className={`${s.tab} ${tab === 'history' ? s.activeTab : ''}`}
          onClick={() => setTab('history')}
        >
          История
        </button>
      </div>

      {tab === 'current' && (
        <>
          {hasPlan ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 12 }}>
                {plan.academicYear} — {plan.semester} семестр
              </p>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Дисциплина</th>
                    <th>Тип</th>
                    <th>Оценка</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.entries.map((entry) => (
                    <tr key={entry.disciplineId}>
                      <td data-label="Дисциплина">{entry.discipline?.name || '—'}</td>
                      <td data-label="Тип" style={{ color: 'var(--text)', fontSize: 13 }}>
                        {entry.discipline?.disciplineType === 'exam' ? 'Экзамен' : 'Зачёт'}
                      </td>
                      <td data-label="Оценка">
                        {entry.gradeValue ? (
                          <>
                            <GradeCell value={entry.gradeValue} />
                            {entry.isDebt && (
                              <span className={`${s.badge} ${s.debtBadge}`}>Долг</span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: 'var(--text)', opacity: 0.4, fontSize: 13 }}>Нет оценки</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className={s.empty}>Дисциплины на текущий семестр не назначены</p>
          )}
        </>
      )}

      {tab === 'all' && (
        <>
          {allGrades.length === 0 ? (
            <p className={s.empty}>Нет оценок</p>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Дисциплина</th>
                  <th>Тип</th>
                  <th>Семестр</th>
                  <th>Оценка</th>
                </tr>
              </thead>
              <tbody>
                {allGrades.map((g) => (
                  <tr key={g.id}>
                    <td data-label="Дисциплина">{g.discipline?.name || '—'}</td>
                    <td data-label="Тип" style={{ color: 'var(--text)', fontSize: 13 }}>
                      {g.discipline?.disciplineType === 'exam' ? 'Экзамен' : 'Зачёт'}
                    </td>
                    <td data-label="Семестр" style={{ color: 'var(--text)', fontSize: 13 }}>
                      {g.semester} сем.
                    </td>
                    <td data-label="Оценка">
                      <GradeCell value={g.gradeValue} />
                      {g.isDebt && (
                        <span className={`${s.badge} ${s.debtBadge}`}>Долг</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          {years.length === 0 ? (
            <p className={s.empty}>История пуста</p>
          ) : (
            years.map((year) => (
              <div key={year}>
                <h3 className={s.historyYear}>{year}</h3>
                {Object.keys(history[year])
                  .sort()
                  .reverse()
                  .map((sem) => (
                    <div key={sem}>
                      <h4 className={s.semesterTitle}>{sem} семестр</h4>
                      <table className={s.table} style={{ tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: '72%' }} />
                          <col style={{ width: '28%' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Дисциплина</th>
                            <th>Оценка</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history[year][sem].map((g) => (
                            <tr key={g.id}>
                              <td data-label="Дисциплина">{g.discipline?.name || '—'}</td>
                              <td data-label="Оценка">
                                <GradeCell value={g.gradeValue} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
              </div>
            ))
          )}
        </>
      )}

      {debts.length > 0 && (
        <>
          <h2 className={s.sectionTitle} style={{ color: '#dc2626', marginTop: 36 }}>
            Задолженности ({debts.length})
          </h2>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Дисциплина</th>
                <th>Период</th>
                <th>Оценка</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((g) => (
                <tr key={g.id}>
                  <td data-label="Дисциплина">{g.discipline?.name || '—'}</td>
                  <td data-label="Период" style={{ color: 'var(--text)', fontSize: 13 }}>
                    {g.academicYear}, {g.semester} сем.
                  </td>
                  <td data-label="Оценка">
                    <GradeCell value={g.gradeValue} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
