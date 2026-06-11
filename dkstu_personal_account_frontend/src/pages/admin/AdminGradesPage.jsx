import { useState, useEffect, useRef } from 'react';
import {
  getGroups,
  getGroupSemesterDisciplines,
  getGroupGrades,
  upsertGrades,
  importGrades as importGradesApi,
} from '../../api/admin';
import { calcCurrentSemester } from '../../utils/semester';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/error';
import s from '../student/shared.module.css';
import styles from './AdminGroupsPage.module.css';

const EXAM_GRADES = [
  { value: '', label: '— Нет оценки —' },
  { value: 'excellent', label: 'Отлично' },
  { value: 'good', label: 'Хорошо' },
  { value: 'satisfactory', label: 'Удовлетворительно' },
  { value: 'unsatisfactory', label: 'Неудовлетворительно' },
  { value: 'absent_exam', label: 'Неявка' },
];

const PASS_FAIL_GRADES = [
  { value: '', label: '— Нет оценки —' },
  { value: 'passed', label: 'Зачёт' },
  { value: 'failed', label: 'Незачёт' },
  { value: 'absent', label: 'Неявка' },
];

export default function AdminGradesPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupQuery, setGroupQuery] = useState('');
  const [debouncedGroupQuery, setDebouncedGroupQuery] = useState('');
  const groupDebounceRef = useRef(null);

  const [semester, setSemester] = useState(null);
  const [disciplines, setDisciplines] = useState([]);
  const [disciplinesLoading, setDisciplinesLoading] = useState(false);

  const [openDiscId, setOpenDiscId] = useState(null);
  const [discGrades, setDiscGrades] = useState({});
  const [discLoading, setDiscLoading] = useState({});
  const [discSaving, setDiscSaving] = useState({});
  const [discSaveResult, setDiscSaveResult] = useState({});

  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const importRef = useRef(null);

  useEffect(() => {
    getGroups()
      .then((r) => setGroups(r.data))
      .catch((err) => showToast(getErrorMessage(err, 'Не удалось загрузить группы')));
  }, []);

  useEffect(() => {
    if (groupDebounceRef.current) clearTimeout(groupDebounceRef.current);
    groupDebounceRef.current = setTimeout(() => setDebouncedGroupQuery(groupQuery), 300);
    return () => clearTimeout(groupDebounceRef.current);
  }, [groupQuery]);

  const filteredGroups = debouncedGroupQuery.trim()
    ? groups.filter((g) => g.name.toLowerCase().includes(debouncedGroupQuery.trim().toLowerCase()))
    : [];

  useEffect(() => {
    if (!selectedGroup) {
      setDisciplines([]);
      setSemester(null);
      return;
    }
    setSemester(calcCurrentSemester(selectedGroup.year));
    setOpenDiscId(null);
    setDiscGrades({});
    setDiscSaveResult({});
  }, [selectedGroup?.id]);

  useEffect(() => {
    if (!selectedGroup || !semester) return;
    setDisciplinesLoading(true);
    setOpenDiscId(null);
    setDiscGrades({});
    setDiscSaveResult({});
    getGroupSemesterDisciplines(selectedGroup.id, semester)
      .then((r) => setDisciplines(r.data))
      .catch((err) => showToast(getErrorMessage(err, 'Не удалось загрузить дисциплины')))
      .finally(() => setDisciplinesLoading(false));
  }, [selectedGroup?.id, semester]);

  const handleToggleDisc = async (disc) => {
    if (openDiscId === disc.id) {
      setOpenDiscId(null);
      return;
    }
    setOpenDiscId(disc.id);

    if (!discGrades[disc.id]) {
      setDiscLoading((prev) => ({ ...prev, [disc.id]: true }));
      try {
        const res = await getGroupGrades(selectedGroup.id, disc.disciplineId, semester);
        setDiscGrades((prev) => ({
          ...prev,
          [disc.id]: {
            students: res.data,
            localGrades: Object.fromEntries(res.data.map((st) => [st.studentId, st.gradeValue || ''])),
          },
        }));
      } catch (err) {
        showToast(getErrorMessage(err, 'Не удалось загрузить оценки'));
      } finally {
        setDiscLoading((prev) => ({ ...prev, [disc.id]: false }));
      }
    }
  };

  const handleGradeChange = (discId, studentId, value) => {
    setDiscGrades((prev) => ({
      ...prev,
      [discId]: {
        ...prev[discId],
        localGrades: { ...prev[discId].localGrades, [studentId]: value },
      },
    }));
    setDiscSaveResult((prev) => ({ ...prev, [discId]: null }));
  };

  const handleSaveDisc = async (disc) => {
    const data = discGrades[disc.id];
    if (!data) return;
    setDiscSaving((prev) => ({ ...prev, [disc.id]: true }));
    setDiscSaveResult((prev) => ({ ...prev, [disc.id]: null }));
    try {
      const grades = data.students.map((st) => ({
        studentId: st.studentId,
        gradeValue: data.localGrades[st.studentId] || null,
      }));
      const res = await upsertGrades({
        disciplineId: disc.disciplineId,
        semester: Number(semester),
        grades,
      });
      setDiscSaveResult((prev) => ({ ...prev, [disc.id]: { ok: true, ...res.data } }));
    } catch (err) {
      showToast(getErrorMessage(err, 'Не удалось сохранить оценки'));
    } finally {
      setDiscSaving((prev) => ({ ...prev, [disc.id]: false }));
    }
  };

  const reloadOpenDisc = async () => {
    if (!openDiscId || !selectedGroup) return;
    const disc = disciplines.find((d) => d.id === openDiscId);
    if (!disc) return;
    try {
      const res = await getGroupGrades(selectedGroup.id, disc.disciplineId, semester);
      setDiscGrades((prev) => ({
        ...prev,
        [openDiscId]: {
          students: res.data,
          localGrades: Object.fromEntries(res.data.map((st) => [st.studentId, st.gradeValue || ''])),
        },
      }));
    } catch {
      // silent
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await importGradesApi(file);
      setImportResult({ ok: true, data: res.data });
      await reloadOpenDisc();
    } catch (err) {
      setImportResult({ ok: false, message: err.response?.data?.message || 'Ошибка импорта' });
    } finally {
      setImportLoading(false);
    }
  };

  const autoSem = selectedGroup ? calcCurrentSemester(selectedGroup.year) : null;

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={s.pageTitle} style={{ margin: 0 }}>Оценки</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={importRef}
            type="file"
            accept=".json,.xml,.xlsx"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
          <button
            className={styles.btnSecondary}
            onClick={() => importRef.current?.click()}
            disabled={importLoading}
          >
            {importLoading ? 'Импорт...' : 'Импорт оценок'}
          </button>
        </div>
      </div>

      {importResult && importResult.ok && (
        <div className={styles.importSuccess}>
          <div className={styles.importSummary}>
            <span>
              Сохранено: <b>{importResult.data.saved}</b>. Пропущено: <b>{importResult.data.skipped}</b>.
            </span>
            <button className={styles.importClose} onClick={() => setImportResult(null)}>✕</button>
          </div>
          {importResult.data.errors?.length > 0 && (
            <ul className={styles.importErrors}>
              {importResult.data.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
      {importResult && !importResult.ok && (
        <div className={styles.importError}>
          <div className={styles.importSummary}>
            <span>{importResult.message}</span>
            <button className={styles.importClose} onClick={() => setImportResult(null)}>✕</button>
          </div>
        </div>
      )}

      <div className={styles.splitLayout}>
        {/* Left: group list */}
        <div className={styles.leftPanel}>
          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Поиск по названию..."
              value={groupQuery}
              onChange={(e) => setGroupQuery(e.target.value)}
            />
          </div>
          <div className={styles.groupList}>
            {!debouncedGroupQuery.trim() && (
              <p className={styles.emptyList}>Введите название группы</p>
            )}
            {debouncedGroupQuery.trim() && filteredGroups.length === 0 && (
              <p className={styles.emptyList}>Групп не найдено</p>
            )}
            {filteredGroups.map((g) => (
              <div
                key={g.id}
                className={`${styles.groupItem} ${selectedGroup?.id === g.id ? styles.groupItemSelected : ''}`}
                onClick={() => { setSelectedGroup(g); setImportResult(null); }}
              >
                <span className={styles.groupItemName}>{g.name}</span>
                <span className={styles.groupItemMeta}>
                  {g.year} · {(g.members || []).length} уч.
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: semester + disciplines accordion */}
        <div className={styles.rightPanel}>
          {!selectedGroup ? (
            <p className={s.empty}>Выберите группу слева</p>
          ) : (
            <>
              <h2 className={styles.groupTitle}>{selectedGroup.name}</h2>

              {/* Semester navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <button
                  className={styles.btnTiny}
                  onClick={() => setSemester((v) => Math.max(1, v - 1))}
                  disabled={!semester || semester <= 1}
                >
                  ◀
                </button>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{semester} семестр</span>
                <button
                  className={styles.btnTiny}
                  onClick={() => setSemester((v) => v + 1)}
                  disabled={selectedGroup.maxSemester != null && semester >= selectedGroup.maxSemester}
                >
                  ▶
                </button>
              </div>

              {disciplinesLoading && <p className={s.empty}>Загрузка дисциплин...</p>}

              {!disciplinesLoading && disciplines.length === 0 && (
                <p className={s.empty}>
                  Дисциплин на {semester} семестр не назначено.{' '}
                  Импортируйте учебный план в разделе «Группы».
                </p>
              )}

              {!disciplinesLoading && disciplines.map((disc) => {
                const isOpen = openDiscId === disc.id;
                const gradeOptions = disc.discipline?.disciplineType === 'pass_fail'
                  ? PASS_FAIL_GRADES
                  : EXAM_GRADES;
                const gradeData = discGrades[disc.id];
                const loading = discLoading[disc.id];
                const saving = discSaving[disc.id];
                const saveResult = discSaveResult[disc.id];

                return (
                  <div
                    key={disc.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      marginBottom: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: isOpen ? 'var(--accent-bg)' : 'transparent',
                        userSelect: 'none',
                      }}
                      onClick={() => handleToggleDisc(disc)}
                    >
                      <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>
                        {disc.discipline?.name}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text)', opacity: 0.55 }}>
                        {disc.discipline?.disciplineType === 'exam' ? 'Экзамен' : 'Зачёт'}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </div>

                    {isOpen && (
                      <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                        {loading && <p className={s.empty}>Загрузка оценок...</p>}

                        {!loading && gradeData && gradeData.students.length === 0 && (
                          <p className={s.empty}>Нет студентов в группе</p>
                        )}

                        {!loading && gradeData && gradeData.students.length > 0 && (
                          <>
                            <table className={s.table} style={{ marginTop: 12 }}>
                              <thead>
                                <tr>
                                  <th>№</th>
                                  <th>Студент</th>
                                  <th>Оценка</th>
                                </tr>
                              </thead>
                              <tbody>
                                {gradeData.students.map((st, idx) => (
                                  <tr key={st.studentId}>
                                    <td
                                      data-label="№"
                                      style={{ width: 36, color: 'var(--text)', opacity: 0.5, fontSize: 13 }}
                                    >
                                      {idx + 1}
                                    </td>
                                    <td data-label="Студент">
                                      <div style={{ fontWeight: 500 }}>{st.fullName}</div>
                                      {st.gradeBook && (
                                        <div style={{ fontSize: 12, color: 'var(--text)', opacity: 0.6 }}>
                                          Зач. кн. {st.gradeBook}
                                        </div>
                                      )}
                                    </td>
                                    <td data-label="Оценка">
                                      <select
                                        className={styles.select}
                                        value={gradeData.localGrades[st.studentId] ?? ''}
                                        onChange={(e) =>
                                          handleGradeChange(disc.id, st.studentId, e.target.value)
                                        }
                                      >
                                        {gradeOptions.map((o) => (
                                          <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                      </select>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
                              <button
                                className={styles.btnPrimary}
                                onClick={() => handleSaveDisc(disc)}
                                disabled={saving}
                              >
                                {saving ? 'Сохранение...' : 'Сохранить'}
                              </button>
                              {saveResult?.ok && (
                                <span style={{ fontSize: 13, color: '#15803d' }}>
                                  Сохранено: {saveResult.saved}. Удалено: {saveResult.cleared}.
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
