import { useState, useEffect, useRef } from 'react';
import {
  getGroups,
  getDisciplines,
  getGroupGrades,
  upsertGrades,
  importGrades as importGradesApi,
} from '../../api/admin';
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

  const [allDisciplines, setAllDisciplines] = useState([]);
  const [discQuery, setDiscQuery] = useState('');
  const [discOpen, setDiscOpen] = useState(false);
  const [selectedDisc, setSelectedDisc] = useState(null);
  const [semester, setSemester] = useState('');

  const [students, setStudents] = useState([]);
  const [localGrades, setLocalGrades] = useState({});
  const [gradesLoading, setGradesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const importRef = useRef(null);

  useEffect(() => {
    getGroups()
      .then((r) => setGroups(r.data))
      .catch((err) => showToast(getErrorMessage(err, 'Не удалось загрузить группы')));
    getDisciplines()
      .then((r) => setAllDisciplines(r.data))
      .catch((err) => showToast(getErrorMessage(err, 'Не удалось загрузить дисциплины')));
  }, []);

  useEffect(() => {
    if (groupDebounceRef.current) clearTimeout(groupDebounceRef.current);
    groupDebounceRef.current = setTimeout(() => setDebouncedGroupQuery(groupQuery), 300);
    return () => clearTimeout(groupDebounceRef.current);
  }, [groupQuery]);

  const filteredGroups = debouncedGroupQuery.trim()
    ? groups.filter((g) => g.name.toLowerCase().includes(debouncedGroupQuery.trim().toLowerCase()))
    : [];

  const discResults = discQuery.trim().length >= 1
    ? allDisciplines.filter((d) => d.name.toLowerCase().includes(discQuery.trim().toLowerCase())).slice(0, 8)
    : [];

  const loadGrades = async (gId, dId, sem) => {
    if (!gId || !dId || !sem) return;
    setGradesLoading(true);
    setSaveResult(null);
    try {
      const res = await getGroupGrades(gId, dId, sem);
      setStudents(res.data);
      const map = {};
      res.data.forEach((st) => { map[st.studentId] = st.gradeValue || ''; });
      setLocalGrades(map);
    } catch (err) {
      showToast(getErrorMessage(err, 'Не удалось загрузить оценки'));
    } finally {
      setGradesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGroup && selectedDisc && semester) {
      loadGrades(selectedGroup.id, selectedDisc.id, semester);
    } else {
      setStudents([]);
      setLocalGrades({});
    }
  }, [selectedGroup?.id, selectedDisc?.id, semester]);

  const handleSave = async () => {
    if (!selectedDisc || !semester) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const grades = students.map((st) => ({
        studentId: st.studentId,
        gradeValue: localGrades[st.studentId] || null,
      }));
      const res = await upsertGrades({
        disciplineId: selectedDisc.id,
        semester: Number(semester),
        grades,
      });
      setSaveResult({ ok: true, ...res.data });
    } catch (err) {
      showToast(getErrorMessage(err, 'Не удалось сохранить оценки'));
    } finally {
      setSaving(false);
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
      if (selectedGroup && selectedDisc && semester) {
        await loadGrades(selectedGroup.id, selectedDisc.id, semester);
      }
    } catch (err) {
      setImportResult({ ok: false, message: err.response?.data?.message || 'Ошибка импорта' });
    } finally {
      setImportLoading(false);
    }
  };

  const gradeOptions = selectedDisc?.disciplineType === 'pass_fail' ? PASS_FAIL_GRADES : EXAM_GRADES;
  const canLoad = !!(selectedGroup && selectedDisc && semester);

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
            {importLoading ? 'Импорт...' : 'Импорт из файла'}
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
                onClick={() => { setSelectedGroup(g); setSaveResult(null); }}
              >
                <span className={styles.groupItemName}>{g.name}</span>
                <span className={styles.groupItemMeta}>
                  {g.year} · {(g.members || []).length} уч.
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: params + grades */}
        <div className={styles.rightPanel}>
          {!selectedGroup ? (
            <p className={s.empty}>Выберите группу слева</p>
          ) : (
            <>
              <h2 className={styles.groupTitle}>{selectedGroup.name}</h2>

              {/* Params */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' }}>
                <div className={styles.formRow} style={{ flex: '1 1 220px', position: 'relative' }}>
                  <label className={styles.label}>Дисциплина</label>
                  <input
                    className={styles.input}
                    placeholder="Поиск дисциплины..."
                    value={discQuery}
                    onChange={(e) => {
                      setDiscQuery(e.target.value);
                      setDiscOpen(true);
                      if (!e.target.value.trim()) setSelectedDisc(null);
                    }}
                    onFocus={() => setDiscOpen(true)}
                    onBlur={() => setTimeout(() => setDiscOpen(false), 150)}
                  />
                  {discOpen && discQuery.trim().length >= 1 && (
                    <div
                      className={styles.searchResults}
                      style={{ position: 'absolute', zIndex: 10, width: '100%', top: '100%' }}
                    >
                      {discResults.map((d) => (
                        <div
                          key={d.id}
                          className={styles.searchResultItem}
                          onMouseDown={() => {
                            setSelectedDisc(d);
                            setDiscQuery(d.name);
                            setDiscOpen(false);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <span className={styles.searchName}>{d.name}</span>
                          <span className={styles.searchEmail}>
                            {d.disciplineType === 'exam' ? 'Экзамен' : 'Зачёт'}
                          </span>
                        </div>
                      ))}
                      {discResults.length === 0 && (
                        <div className={styles.searchResultItem} style={{ color: 'var(--text)', opacity: 0.6, cursor: 'default' }}>
                          Не найдено
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.formRow} style={{ flex: '0 0 80px' }}>
                  <label className={styles.label}>Семестр</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={1} max={12}
                    placeholder="1"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                  />
                </div>
              </div>

              {/* Students table */}
              {!canLoad && (
                <p className={s.empty}>Выберите дисциплину и семестр</p>
              )}

              {canLoad && gradesLoading && <p className={s.empty}>Загрузка оценок...</p>}

              {canLoad && !gradesLoading && students.length === 0 && (
                <p className={s.empty}>Нет студентов в группе</p>
              )}

              {canLoad && !gradesLoading && students.length > 0 && (
                <>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Студент</th>
                        <th>Оценка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((st, idx) => (
                        <tr key={st.studentId}>
                          <td data-label="№" style={{ width: 36, color: 'var(--text)', opacity: 0.5, fontSize: 13 }}>
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
                              value={localGrades[st.studentId] ?? ''}
                              onChange={(e) =>
                                setLocalGrades((prev) => ({ ...prev, [st.studentId]: e.target.value }))
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
                    <button
                      className={styles.btnPrimary}
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? 'Сохранение...' : 'Сохранить оценки'}
                    </button>
                    {saveResult?.ok && (
                      <span style={{ fontSize: 13, color: '#15803d' }}>
                        Сохранено: {saveResult.saved}. Удалено: {saveResult.cleared}.
                      </span>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
