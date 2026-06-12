import { useState, useEffect } from 'react';
import { getAllGrades, getGpa, getDebts, getMyCurrentSemesterPlan, getMyGroup } from '../../api/students';
import { calcCurrentSemester } from '../../utils/semester';
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
  const [plan, setPlan] = useState(null);
  const [allGrades, setAllGrades] = useState([]);
  const [gpa, setGpa] = useState(null);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [groupYear, setGroupYear] = useState(null);
  const [maxSemester, setMaxSemester] = useState(null);
  const [historySemester, setHistorySemester] = useState(null);
  const [historyPlan, setHistoryPlan] = useState(null);
  const [historyPlanLoading, setHistoryPlanLoading] = useState(false);

  useEffect(() => {
    getMyGroup()
      .then((groupRes) => {
        const groups = groupRes.data || [];
        let currentSem;
        if (groups.length > 0) {
          const g = groups[0];
          setGroupYear(g.year);
          setMaxSemester(g.maxSemester ?? null);
          currentSem = calcCurrentSemester(g.year);
          setHistorySemester(currentSem);
        }
        return Promise.all([
          getGpa(),
          getDebts(),
          getMyCurrentSemesterPlan(currentSem),
          getAllGrades(),
        ]);
      })
      .then(([gpaRes, debtsRes, planRes, allRes]) => {
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

  useEffect(() => {
    if (historySemester == null) return;
    setHistoryPlanLoading(true);
    getMyCurrentSemesterPlan(historySemester)
      .then((res) => setHistoryPlan(res.data))
      .catch(() => setHistoryPlan(null))
      .finally(() => setHistoryPlanLoading(false));
  }, [historySemester]);

  const hasPlan = plan && plan.entries && plan.entries.length > 0;

  const autoHistorySem = groupYear ? calcCurrentSemester(groupYear) : null;

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
                {plan.semester} семестр
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
          {historySemester == null ? (
            <p className={s.empty}>Нет данных о группе</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <button
                  className={s.btnTiny}
                  onClick={() => setHistorySemester((v) => Math.max(1, v - 1))}
                  disabled={historySemester <= 1}
                >
                  ◀
                </button>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{historySemester} семестр</span>
                <button
                  className={s.btnTiny}
                  onClick={() => setHistorySemester((v) => v + 1)}
                  disabled={maxSemester != null && historySemester >= maxSemester}
                >
                  ▶
                </button>
                {autoHistorySem !== historySemester && (
                  <span style={{ fontSize: 12, color: 'var(--text)', opacity: 0.5 }}>
                    (текущий семестр: {autoHistorySem})
                  </span>
                )}
              </div>

              {historyPlanLoading && <p className={s.empty}>Загрузка...</p>}

              {!historyPlanLoading && historyPlan && historyPlan.entries && historyPlan.entries.length > 0 && (
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Дисциплина</th>
                      <th>Тип</th>
                      <th>Оценка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyPlan.entries.map((entry) => (
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
              )}

              {!historyPlanLoading && (!historyPlan || !historyPlan.entries || historyPlan.entries.length === 0) && (
                <p className={s.empty}>Дисциплин на {historySemester} семестр не назначено</p>
              )}
            </>
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
                    {g.semester} сем.
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
