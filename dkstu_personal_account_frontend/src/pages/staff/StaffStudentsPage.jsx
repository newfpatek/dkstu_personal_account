import { useState, useEffect, useRef } from 'react';
import {
  searchStudents,
  getStudentProfile,
  getStudentAllGrades,
  getStudentScholarship,
  getStudentPortfolio,
  fetchStudentPortfolioFile,
} from '../../api/staff';
import { formatDate } from '../../utils/date';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/error';
import s from '../student/shared.module.css';
import styles from './StaffStudentsPage.module.css';

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

const CATEGORIES_ORDER = ['academic', 'research', 'social', 'sports', 'cultural'];

const CATEGORY_LABELS = {
  academic: 'Учебная',
  research: 'Научная',
  social: 'Общественная',
  sports: 'Спортивная',
  cultural: 'Культурная',
};

const CATEGORY_COLORS = {
  academic: '#2563eb',
  research: '#7c3aed',
  social: '#16a34a',
  sports: '#d97706',
  cultural: '#db2777',
};

const NUMERIC_GRADES = {
  excellent: 5,
  good: 4,
  satisfactory: 3,
  unsatisfactory: 2,
  absent_exam: 2,
};

function computeGpa(gradesFlat) {
  const values = gradesFlat
    .map((g) => NUMERIC_GRADES[g.gradeValue])
    .filter((v) => v !== undefined);
  if (!values.length) return null;
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
}

function openBlob(data, contentType, fileName, inline) {
  const blob = new Blob([data], { type: contentType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  if (inline) {
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

function formatAmount(amount) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(amount);
}

function GradeCell({ value }) {
  return (
    <span style={{ color: GRADE_COLORS[value] || 'inherit', fontWeight: 500 }}>
      {GRADE_LABELS[value] || value}
    </span>
  );
}

const PORTFOLIO_FILTER_CHIPS = [
  { value: '', label: 'Все' },
  { value: 'academic', label: 'Учебная' },
  { value: 'research', label: 'Научная' },
  { value: 'social', label: 'Общественная' },
  { value: 'sports', label: 'Спортивная' },
  { value: 'cultural', label: 'Культурная' },
];

function StudentDetail({ studentId }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState('grades');
  const [profile, setProfile] = useState(null);
  const [gradesFlat, setGradesFlat] = useState([]);
  const [scholarship, setScholarship] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [fileLoadingId, setFileLoadingId] = useState(null);
  const [portCategory, setPortCategory] = useState('');
  const [portSearch, setPortSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    setProfile(null);
    setGradesFlat([]);
    setScholarship(null);
    setPortfolio([]);
    setPortCategory('');
    setPortSearch('');

    Promise.all([
      getStudentProfile(studentId),
      getStudentAllGrades(studentId),
      getStudentScholarship(studentId),
      getStudentPortfolio(studentId),
    ])
      .then(([profileRes, gradesRes, schRes, portRes]) => {
        setProfile(profileRes.data);
        setGradesFlat(gradesRes.data);
        setScholarship(schRes.data);
        setPortfolio(portRes.data);
      })
      .catch((err) => {
        showToast(getErrorMessage(err, 'Не удалось загрузить данные студента'));
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [studentId]);

  const handleFileAction = async (item, inline) => {
    setFileLoadingId(item.id);
    try {
      const res = await fetchStudentPortfolioFile(studentId, item.id, inline);
      const contentType = res.headers['content-type'];
      openBlob(res.data, contentType, item.fileName, inline);
    } catch (err) {
      showToast(getErrorMessage(err, 'Не удалось открыть файл'));
    } finally {
      setFileLoadingId(null);
    }
  };

  if (loading) return <p className={s.empty}>Загрузка...</p>;
  if (loadError) return <p className={s.errorMsg}>Не удалось загрузить данные. Попробуйте обновить страницу.</p>;
  if (!profile) return null;

  const initials = profile.fullName
    ? profile.fullName.split(' ').slice(0, 2).map((p) => p[0]).join('')
    : '?';

  const gpa = computeGpa(gradesFlat);

  return (
    <div>
      {/* Profile header */}
      <div className={styles.profileHeader}>
        <div className={styles.profileAvatar}>{initials}</div>
        <div className={styles.profileInfo}>
          <span className={styles.profileFullName}>{profile.fullName}</span>
          <span className={styles.profileEmail}>{profile.email}</span>
          {profile.groups?.length > 0 && (
            <div className={styles.profileGroups}>
              {profile.groups.map((g) => (
                <span key={g.id} className={styles.groupTag}>
                  {g.name}
                  {g.groupRole && ` · ${g.groupRole}`}
                </span>
              ))}
            </div>
          )}
          {profile.isPaid && (
            <span className={styles.paidTag} style={{ marginTop: 4, alignSelf: 'flex-start' }}>
              Контрактник
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={s.tabs}>
        <button
          className={`${s.tab} ${tab === 'grades' ? s.activeTab : ''}`}
          onClick={() => setTab('grades')}
        >
          Зачётная книжка
        </button>
        <button
          className={`${s.tab} ${tab === 'scholarship' ? s.activeTab : ''}`}
          onClick={() => setTab('scholarship')}
        >
          Стипендия
        </button>
        <button
          className={`${s.tab} ${tab === 'portfolio' ? s.activeTab : ''}`}
          onClick={() => setTab('portfolio')}
        >
          Портфолио
        </button>
      </div>

      {/* Grades tab */}
      {tab === 'grades' && (
        <>
          <div className={s.summaryRow} style={{ marginBottom: 20 }}>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>Средний балл</span>
              <span className={s.summaryValue}>{gpa !== null ? gpa : '—'}</span>
            </div>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>Задолженности</span>
              <span
                className={s.summaryValue}
                style={{ color: gradesFlat.filter((g) => g.isDebt).length > 0 ? '#dc2626' : '#16a34a' }}
              >
                {gradesFlat.filter((g) => g.isDebt).length}
              </span>
            </div>
          </div>
          {gradesFlat.length === 0 ? (
            <p className={s.empty}>Оценок пока нет</p>
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
                {gradesFlat.map((g) => (
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

      {/* Scholarship tab */}
      {tab === 'scholarship' && (
        <>
          {scholarship?.isPaid && (
            <div className={styles.infoBox}>
              Студент обучается на платной основе — стипендия не начисляется.
            </div>
          )}
          {!scholarship?.isPaid && scholarship?.scholarships?.length === 0 && (
            <p className={s.empty}>Стипендия не назначена</p>
          )}
          {!scholarship?.isPaid && scholarship?.scholarships?.length > 0 && (
            <div className={styles.scholarshipCards}>
              {scholarship.scholarships.map((sc) => (
                <div key={sc.id} className={styles.scholarshipCard}>
                  <span className={styles.schType}>
                    {SCHOLARSHIP_LABELS[sc.type] || sc.type}
                  </span>
                  {sc.direction && (
                    <span className={styles.schDirection}>
                      {DIRECTION_LABELS[sc.direction] || sc.direction}
                    </span>
                  )}
                  <span className={styles.schAmount}>{formatAmount(sc.amount)}</span>
                  <span className={styles.schMeta}>
                    с {formatDate(sc.periodStart)}
                    {sc.periodEnd && ` по ${formatDate(sc.periodEnd)}`}
                  </span>
                  <div className={styles.schStatus}>
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
        </>
      )}

      {/* Portfolio tab */}
      {tab === 'portfolio' && (
        <>
          {/* Category filter chips */}
          <div className={styles.portFilterRow}>
            {PORTFOLIO_FILTER_CHIPS.map((c) => (
              <button
                key={c.value}
                className={`${styles.portFilterBtn} ${portCategory === c.value ? styles.portFilterActive : ''}`}
                onClick={() => setPortCategory(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Search input */}
          <input
            className={styles.portSearchInput}
            type="text"
            placeholder="Поиск по названию или описанию..."
            value={portSearch}
            onChange={(e) => setPortSearch(e.target.value)}
          />

          {portfolio.length === 0 ? (
            <p className={s.empty}>Портфолио пусто</p>
          ) : (() => {
            const q = portSearch.trim().toLowerCase();
            const visible = portfolio.filter((i) => {
              const matchCat = !portCategory || i.category === portCategory;
              const matchQ = !q || i.title.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q);
              return matchCat && matchQ;
            });

            if (!visible.length) {
              return <p className={s.empty}>Ничего не найдено</p>;
            }

            return (
              <div className={styles.portfolioList}>
                {visible.map((item) => (
                  <div key={item.id} className={styles.portfolioItem}>
                    <div style={{ flex: 1 }}>
                      <div className={styles.portfolioTitle}>
                        {item.title}
                        <span
                          className={styles.categoryBadge}
                          style={{
                            background: `${CATEGORY_COLORS[item.category]}18`,
                            color: CATEGORY_COLORS[item.category],
                          }}
                        >
                          {CATEGORY_LABELS[item.category] || item.category}
                        </span>
                      </div>
                      {item.description && (
                        <div className={styles.portfolioMeta}>{item.description}</div>
                      )}
                      <div className={styles.portfolioMeta}>
                        {item.fileName && <span>{item.fileName} · </span>}
                        {formatDate(item.createdAt)}
                      </div>
                    </div>
                    {item.fileName && (
                      <button
                        className={styles.fileActionBtn}
                        onClick={() => handleFileAction(item, true)}
                        disabled={fileLoadingId === item.id}
                        style={{ flexShrink: 0, alignSelf: 'flex-start' }}
                      >
                        Открыть
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

export default function StaffStudentsPage() {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setStudents([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      searchStudents(query)
        .then((r) => setStudents(r.data))
        .catch((err) => showToast(getErrorMessage(err, 'Ошибка поиска студентов')))
        .finally(() => setLoading(false));
    }, 1000);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div>
      <h1 className={s.pageTitle}>Студенты</h1>

      <div className={styles.splitLayout}>
        {/* Left panel */}
        <div className={styles.leftPanel}>
          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Поиск по имени или email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className={styles.studentList}>
            {loading && <p className={styles.emptyList}>Загрузка...</p>}
            {!loading && !query.trim() && (
              <p className={styles.emptyList}>Введите имя или email для поиска</p>
            )}
            {!loading && query.trim() && students.length === 0 && (
              <p className={styles.emptyList}>Студентов не найдено</p>
            )}
            {!loading &&
              students.map((student) => (
                <div
                  key={student.id}
                  className={`${styles.studentItem} ${
                    student.id === selectedId ? styles.studentItemSelected : ''
                  }`}
                  onClick={() => setSelectedId(student.id)}
                >
                  <span className={styles.studentName}>
                    {student.fullName}
                    {student.isPaid && (
                      <span className={styles.paidTag}>Контракт</span>
                    )}
                  </span>
                  <span className={styles.studentMeta}>
                    {student.groups?.length > 0
                      ? student.groups.map((g) => g.name).join(', ')
                      : student.email}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Right panel */}
        <div className={styles.rightPanel}>
          {selectedId ? (
            <StudentDetail key={selectedId} studentId={selectedId} />
          ) : (
            <div className={styles.placeholder}>
              Выберите студента из списка
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
