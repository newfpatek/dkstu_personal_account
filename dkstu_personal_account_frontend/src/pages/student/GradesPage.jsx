import { useState, useEffect } from 'react';
import { getGradesHistory, getGpa, getDebts } from '../../api/students';
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
  const [tab, setTab] = useState('current');
  const [history, setHistory] = useState({});
  const [gpa, setGpa] = useState(null);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getGradesHistory(), getGpa(), getDebts()])
      .then(([histRes, gpaRes, debtsRes]) => {
        setHistory(histRes.data);
        setGpa(gpaRes.data.gpa);
        setDebts(debtsRes.data);
      })
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false));
  }, []);

  // Найти последний (текущий) год и семестр
  const years = Object.keys(history).sort().reverse();
  const currentYear = years[0];
  const currentSemesters = currentYear ? Object.keys(history[currentYear]).sort().reverse() : [];
  const currentSemester = currentSemesters[0];
  const currentGrades = currentYear && currentSemester ? history[currentYear][currentSemester] : [];

  if (loading) return <p className={s.empty}>Загрузка...</p>;
  if (error) return <p className={s.errorMsg}>{error}</p>;

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
          className={`${s.tab} ${tab === 'history' ? s.activeTab : ''}`}
          onClick={() => setTab('history')}
        >
          История
        </button>
      </div>

      {tab === 'current' && (
        <>
          {currentGrades.length === 0 ? (
            <p className={s.empty}>Нет оценок за текущий период</p>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 12 }}>
                {currentYear} — {currentSemester} семестр
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
                  {currentGrades.map((g) => (
                    <tr key={g.id}>
                      <td>{g.discipline?.name || '—'}</td>
                      <td style={{ color: 'var(--text)', fontSize: 13 }}>
                        {g.discipline?.disciplineType === 'exam' ? 'Экзамен' : 'Зачёт'}
                      </td>
                      <td>
                        <GradeCell value={g.gradeValue} />
                        {g.isDebt && (
                          <span className={`${s.badge} ${s.debtBadge}`}>Долг</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
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
                      <table className={s.table}>
                        <thead>
                          <tr>
                            <th>Дисциплина</th>
                            <th>Оценка</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history[year][sem].map((g) => (
                            <tr key={g.id}>
                              <td>{g.discipline?.name || '—'}</td>
                              <td>
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
                  <td>{g.discipline?.name || '—'}</td>
                  <td style={{ color: 'var(--text)', fontSize: 13 }}>
                    {g.academicYear}, {g.semester} сем.
                  </td>
                  <td>
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
