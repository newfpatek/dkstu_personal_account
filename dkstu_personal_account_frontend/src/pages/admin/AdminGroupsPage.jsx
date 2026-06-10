import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  getGroups,
  createGroup,
  deleteGroup,
  addUserToGroup,
  removeUserFromGroup,
  setGroupRole,
  removeGroupRole,
  getUsers,
  importGroup,
  getDisciplines,
  createDiscipline as createDisciplineApi,
  getGroupSemesterDisciplines,
  assignGroupDisciplines,
  removeGroupSemesterDiscipline,
  importGroupDisciplines,
} from '../../api/admin';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/error';
import s from '../student/shared.module.css';
import styles from './AdminGroupsPage.module.css';

const ROLE_LABELS = {
  student: 'Студент',
  teacher: 'Преподаватель',
  staff: 'Сотрудник',
  admin: 'Администратор',
};

const ROLE_COLORS = {
  student: '#2563eb',
  teacher: '#7c3aed',
  staff: '#16a34a',
  admin: '#dc2626',
};

function CreateGroupForm({ onSave, onCancel, loading, error }) {
  const [name, setName] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name: name.trim(), year: Number(year) });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formRow}>
        <label className={styles.label}>Название группы</label>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="И-122"
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.label}>Год набора</label>
        <input
          className={styles.input}
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          required
          min={2000}
          max={2100}
        />
      </div>
      {error && <p className={s.errorMsg}>{error}</p>}
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={loading}>
          {loading ? 'Создание...' : 'Создать'}
        </button>
        <button type="button" className={styles.btnSecondary} onClick={onCancel} disabled={loading}>
          Отмена
        </button>
      </div>
    </form>
  );
}

function AddMemberPanel({ groupId, existingIds, onAdded }) {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return; }
      try {
        const res = await getUsers();
        const q = query.trim().toLowerCase();
        const filtered = res.data.filter(
          (u) =>
            !existingIds.has(u.id) &&
            (u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
        );
        setResults(filtered.slice(0, 10));
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleAdd = async (user) => {
    setLoadingId(user.id);
    try {
      await addUserToGroup(groupId, user.id);
      setQuery('');
      setResults([]);
      onAdded();
    } catch (e) {
      showToast(getErrorMessage(e, 'Ошибка при добавлении участника'));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className={styles.addMemberPanel}>
      <p className={styles.sectionLabel}>Добавить участника</p>
      <div className={styles.addMemberRow}>
        <input
          className={styles.input}
          type="text"
          placeholder="Поиск по имени или email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {results.length > 0 && (
        <div className={styles.searchResults}>
          {results.map((u) => (
            <div key={u.id} className={styles.searchResultItem}>
              <span className={styles.searchName}>
                {u.fullName}
                <span
                  className={styles.roleDot}
                  style={{ color: ROLE_COLORS[u.role] }}
                >
                  {ROLE_LABELS[u.role] || u.role}
                </span>
              </span>
              <span className={styles.searchEmail}>{u.email}</span>
              <button
                className={styles.btnSmall}
                onClick={() => handleAdd(u)}
                disabled={loadingId === u.id}
              >
                {loadingId === u.id ? '...' : '+ Добавить'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const GROUP_ROLES = [
  { value: '', label: 'Без роли' },
  { value: 'Староста', label: 'Староста' },
  { value: 'Зам. старосты', label: 'Зам. старосты' },
  { value: 'Профорг', label: 'Профорг' },
];

function SetRoleModal({ member, groupId, onSave, onClose }) {
  const { showToast } = useToast();
  const [label, setLabel] = useState(member.groupRole || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (label) {
        await setGroupRole(groupId, member.id, label);
      } else {
        await removeGroupRole(groupId, member.id);
      }
      onSave();
    } catch (e) {
      showToast(getErrorMessage(e, 'Ошибка при сохранении роли'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Роль в группе</h3>
        <p className={styles.modalDesc}>{member.fullName}</p>
        <select
          className={styles.select}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        >
          {GROUP_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <div className={styles.formActions} style={{ marginTop: 14 }}>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupDisciplinesPanel({ groupId }) {
  const { showToast } = useToast();
  const [allDisciplines, setAllDisciplines] = useState([]);
  const [planEntries, setPlanEntries] = useState([]);
  const [semester, setSemester] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [selected, setSelected] = useState([]); // [{id, name, disciplineType}]
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const importRef = useRef(null);

  const loadPlan = async () => {
    try {
      const res = await getGroupSemesterDisciplines(groupId);
      setPlanEntries(res.data);
    } catch (err) {
      showToast(getErrorMessage(err, 'Не удалось загрузить план дисциплин'));
    }
  };

  useEffect(() => {
    getDisciplines().then((r) => setAllDisciplines(r.data)).catch((err) => showToast(getErrorMessage(err, 'Не удалось загрузить дисциплины')));
    loadPlan();
  }, [groupId]);

  // Подставляем семестр/год из существующего плана при первой загрузке
  useEffect(() => {
    if (planEntries.length > 0 && !semester && !academicYear) {
      setSemester(String(planEntries[0].semester));
      setAcademicYear(planEntries[0].academicYear);
    }
  }, [planEntries]);

  const assignedIds = new Set(planEntries.map((e) => e.disciplineId));
  const selectedIds = new Set(selected.map((d) => d.id));

  // Результаты поиска: исключаем уже назначенные и уже выбранные
  const searchResults = searchQuery.trim().length >= 1
    ? allDisciplines.filter(
        (d) =>
          !assignedIds.has(d.id) &&
          !selectedIds.has(d.id) &&
          d.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
      ).slice(0, 8)
    : [];

  const handleSelectDiscipline = (d) => {
    setSelected((prev) => [...prev, d]);
    setSearchQuery('');
  };

  const handleRemoveSelected = (id) => {
    setSelected((prev) => prev.filter((d) => d.id !== id));
  };

  const handleAssign = async () => {
    if (!selected.length || !semester || !academicYear) return;
    setSaving(true);
    try {
      await assignGroupDisciplines({
        groupId,
        disciplineIds: selected.map((d) => d.id),
        semester: Number(semester),
        academicYear,
      });
      setSelected([]);
      await loadPlan();
    } catch (e) {
      showToast(getErrorMessage(e, 'Ошибка при добавлении дисциплин'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePlan = async (id) => {
    setRemovingId(id);
    try {
      await removeGroupSemesterDiscipline(id);
      await loadPlan();
    } catch (e) {
      showToast(getErrorMessage(e, 'Ошибка при удалении дисциплины'));
    } finally {
      setRemovingId(null);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await importGroupDisciplines(file);
      setImportResult({ ok: true, data: res.data });
      const [, discRes] = await Promise.all([loadPlan(), getDisciplines()]);
      setAllDisciplines(discRes.data);
    } catch (err) {
      setImportResult({ ok: false, message: err.response?.data?.message || 'Ошибка импорта' });
    } finally {
      setImportLoading(false);
    }
  };

  const handleCreateDiscipline = async (name, type) => {
    try {
      const res = await createDisciplineApi(name, type);
      const newDisc = res.data;
      setAllDisciplines((prev) => [...prev, newDisc].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
      handleSelectDiscipline(newDisc);
    } catch (err) {
      showToast(getErrorMessage(err, 'Ошибка при создании дисциплины'));
    }
  };

  // Текущий назначенный семестр (один активный)
  const activeSemesterLabel = planEntries.length > 0
    ? `${planEntries[0].academicYear} — ${planEntries[0].semester} семестр`
    : null;

  return (
    <div style={{ marginTop: 24 }}>
      <p className={styles.sectionLabel}>Дисциплины на семестр</p>

      {importResult && importResult.ok && (
        <div className={styles.importSuccess} style={{ marginBottom: 12 }}>
          Добавлено: {importResult.data.assigned}. Пропущено: {importResult.data.skipped}.
          {importResult.data.errors?.length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12 }}>
              {importResult.data.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
        </div>
      )}
      {importResult && !importResult.ok && (
        <div className={styles.importError} style={{ marginBottom: 12 }}>{importResult.message}</div>
      )}

      {/* Форма добавления */}
      <div className={styles.addMemberPanel}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <div className={styles.formRow} style={{ flex: '0 0 100px' }}>
            <label className={styles.label}>Семестр</label>
            <input
              className={styles.input}
              type="number"
              min={1} max={12}
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="1"
            />
          </div>
          <div className={styles.formRow} style={{ flex: '0 0 140px' }}>
            <label className={styles.label}>Учебный год</label>
            <input
              className={styles.input}
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="2025-2026"
            />
          </div>
        </div>

        {/* Поиск дисциплины */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input
            className={styles.input}
            placeholder="Поиск дисциплины..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          />
          {searchOpen && searchQuery.trim().length >= 1 && (
            <div className={styles.searchResults} style={{ position: 'absolute', zIndex: 10, width: '100%', top: '100%' }}>
              {searchResults.map((d) => (
                <div
                  key={d.id}
                  className={styles.searchResultItem}
                  onMouseDown={() => handleSelectDiscipline(d)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className={styles.searchName}>{d.name}</span>
                  <span className={styles.searchEmail}>
                    {d.disciplineType === 'exam' ? 'Экзамен' : 'Зачёт'}
                  </span>
                </div>
              ))}
              {searchResults.length === 0 && (
                <>
                  <div
                    className={styles.searchResultItem}
                    onMouseDown={() => handleCreateDiscipline(searchQuery.trim(), 'exam')}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className={styles.searchName}>➕ Создать «{searchQuery.trim()}»</span>
                    <span className={styles.searchEmail}>Экзамен</span>
                  </div>
                  <div
                    className={styles.searchResultItem}
                    onMouseDown={() => handleCreateDiscipline(searchQuery.trim(), 'pass_fail')}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className={styles.searchName}>➕ Создать «{searchQuery.trim()}»</span>
                    <span className={styles.searchEmail}>Зачёт</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Выбранные чипы */}
        {selected.length > 0 && (
          <div className={styles.chipList}>
            {selected.map((d) => (
              <span key={d.id} className={styles.chip}>
                {d.name}
                <span className={styles.chipType}>
                  {d.disciplineType === 'exam' ? 'Экзамен' : 'Зачёт'}
                </span>
                <button
                  className={styles.chipRemove}
                  onClick={() => handleRemoveSelected(d.id)}
                  title="Убрать"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button
            className={styles.btnPrimary}
            onClick={handleAssign}
            disabled={saving || !selected.length || !semester || !academicYear}
          >
            {saving ? 'Сохранение...' : `Добавить выбранные (${selected.length})`}
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,.xml"
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

      {/* Текущий план */}
      {planEntries.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p className={styles.sectionLabel} style={{ marginBottom: 6 }}>
            Текущий план: {activeSemesterLabel}
          </p>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Дисциплина</th>
                <th>Тип</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {planEntries.map((e) => (
                <tr key={e.id}>
                  <td data-label="Дисциплина">{e.discipline?.name}</td>
                  <td data-label="Тип" style={{ fontSize: 13, color: 'var(--text)' }}>
                    {e.discipline?.disciplineType === 'exam' ? 'Экзамен' : 'Зачёт'}
                  </td>
                  <td data-label="">
                    <button
                      className={styles.btnTinyDanger}
                      onClick={() => handleRemovePlan(e.id)}
                      disabled={removingId === e.id}
                    >
                      Убрать
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {planEntries.length === 0 && (
        <p className={s.empty} style={{ marginTop: 8 }}>Дисциплины на семестр ещё не назначены</p>
      )}
    </div>
  );
}

function GroupDetail({ group, onDeleted, onRefresh }) {
  const { showToast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [roleModal, setRoleModal] = useState(null);

  const existingIds = new Set((group.members || []).map((m) => m.id));

  const handleRemove = async (member) => {
    if (!window.confirm(`Убрать «${member.fullName}» из группы?`)) return;
    setRemovingId(member.id);
    try {
      await removeUserFromGroup(group.id, member.id);
      onRefresh();
    } catch (e) {
      showToast(getErrorMessage(e, 'Ошибка при удалении участника'));
    } finally {
      setRemovingId(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(`Удалить группу «${group.name}»? Все участники будут исключены.`)) return;
    try {
      await deleteGroup(group.id);
      onDeleted();
    } catch (e) {
      showToast(getErrorMessage(e, 'Ошибка при удалении группы'));
    }
  };

  const students = (group.members || []).filter((m) => m.role === 'student');
  const others = (group.members || []).filter((m) => m.role !== 'student');

  return (
    <div>
      <div className={styles.groupHeader}>
        <div>
          <h2 className={styles.groupName}>{group.name}</h2>
          <span className={styles.groupYear}>Год набора: {group.year}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={styles.btnSecondary}
            onClick={() => setAddOpen((v) => !v)}
          >
            {addOpen ? 'Закрыть' : '+ Добавить участника'}
          </button>
          <button className={styles.btnDanger} onClick={handleDeleteGroup}>
            Удалить группу
          </button>
        </div>
      </div>

      {addOpen && (
        <AddMemberPanel
          groupId={group.id}
          existingIds={existingIds}
          onAdded={() => { onRefresh(); setAddOpen(false); }}
        />
      )}

      {/* Students */}
      {students.length > 0 && (
        <>
          <p className={styles.sectionLabel} style={{ marginTop: 20 }}>
            Студенты ({students.length})
          </p>
          <table className={s.table}>
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Роль в группе</th>
                <th>Тип обучения</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students
                .slice()
                .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'))
                .map((m) => (
                  <tr key={m.id}>
                    <td data-label="ФИО">{m.fullName}</td>
                    <td data-label="Роль в группе">
                      {m.groupRole ? (
                        <span className={styles.groupRoleTag}>{m.groupRole}</span>
                      ) : (
                        <span style={{ color: 'var(--text)', opacity: 0.45, fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td data-label="Обучение">
                      {m.isPaid ? (
                        <span className={styles.paidTag}>Контракт</span>
                      ) : (
                        <span style={{ color: 'var(--text)', opacity: 0.55, fontSize: 13 }}>Бюджет</span>
                      )}
                    </td>
                    <td data-label="">
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className={styles.btnTiny}
                          onClick={() => setRoleModal(m)}
                        >
                          Роль
                        </button>
                        <button
                          className={styles.btnTinyDanger}
                          onClick={() => handleRemove(m)}
                          disabled={removingId === m.id}
                        >
                          Убрать
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}

      {/* Others (teacher/staff) */}
      {others.length > 0 && (
        <>
          <p className={styles.sectionLabel} style={{ marginTop: 24 }}>
            Прочие участники
          </p>
          <table className={s.table}>
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Роль в системе</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {others.map((m) => (
                <tr key={m.id}>
                  <td data-label="ФИО">{m.fullName}</td>
                  <td data-label="Роль">
                    <span
                      style={{ color: ROLE_COLORS[m.role], fontWeight: 500, fontSize: 13 }}
                    >
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                  </td>
                  <td data-label="">
                    <button
                      className={styles.btnTinyDanger}
                      onClick={() => handleRemove(m)}
                      disabled={removingId === m.id}
                    >
                      Убрать
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {(group.members || []).length === 0 && (
        <p className={s.empty}>В группе пока нет участников</p>
      )}

      <GroupDisciplinesPanel groupId={group.id} />

      {roleModal && (
        <SetRoleModal
          member={roleModal}
          groupId={group.id}
          onSave={() => { setRoleModal(null); onRefresh(); }}
          onClose={() => setRoleModal(null)}
        />
      )}
    </div>
  );
}

export default function AdminGroupsPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [query, setQuery] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const importFileRef = useRef(null);

  const loadGroups = async (keepSelected) => {
    setLoading(true);
    try {
      const res = await getGroups();
      setGroups(res.data);
      if (keepSelected && selectedGroup) {
        const updated = res.data.find((g) => g.id === selectedGroup.id);
        setSelectedGroup(updated || null);
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Не удалось загрузить группы'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups(false);
  }, []);

  const handleCreate = async (data) => {
    setCreateLoading(true);
    setCreateError('');
    try {
      await createGroup(data);
      await loadGroups(false);
      setShowCreate(false);
    } catch (e) {
      const msg = getErrorMessage(e, 'Ошибка при создании группы');
      setCreateError(msg);
      showToast(msg);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await importGroup(file);
      setImportResult({ ok: true, data: res.data });
      await loadGroups(false);
    } catch (err) {
      setImportResult({ ok: false, message: err.response?.data?.message || 'Ошибка импорта' });
    } finally {
      setImportLoading(false);
    }
  };

  const downloadExcel = (groupName, rows) => {
    const data = rows.map((r) => ({ Группа: groupName || '', Email: r.email, Пароль: r.password }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Пароли');
    XLSX.writeFile(wb, `passwords_${groupName || 'group'}.xlsx`);
  };

  const [debouncedQuery, setDebouncedQuery] = useState('');
  const queryDebounceRef = useRef(null);

  useEffect(() => {
    if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current);
    queryDebounceRef.current = setTimeout(() => setDebouncedQuery(query), 1000);
    return () => clearTimeout(queryDebounceRef.current);
  }, [query]);

  const filteredGroups = debouncedQuery.trim()
    ? groups.filter((g) => g.name.toLowerCase().includes(debouncedQuery.trim().toLowerCase()))
    : [];

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={s.pageTitle} style={{ margin: 0 }}>
          Группы
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={importFileRef}
            type="file"
            accept=".json,.xml"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
          <button
            className={styles.btnSecondary}
            onClick={() => importFileRef.current?.click()}
            disabled={importLoading}
          >
            {importLoading ? 'Импорт...' : 'Импорт из файла'}
          </button>
          <button
            className={styles.btnPrimary}
            onClick={() => { setShowCreate(true); setSelectedGroup(null); setImportResult(null); }}
          >
            + Создать группу
          </button>
        </div>
      </div>

      {importResult && importResult.ok && (
        <div className={styles.importSuccess}>
          <div className={styles.importSummary}>
            <span>
              Группа <strong>{importResult.data.group?.name}</strong> создана.
              {' '}Добавлено участников: <b>{importResult.data.added}</b>.
              {importResult.data.created > 0 && <> Создано новых: <b>{importResult.data.created}</b>.</>}
              {importResult.data.skipped > 0 && <> Пропущено: <b>{importResult.data.skipped}</b>.</>}
            </span>
            <button className={styles.importClose} onClick={() => setImportResult(null)}>✕</button>
          </div>
          {importResult.data.errors?.length > 0 && (
            <ul className={styles.importErrors}>
              {importResult.data.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          {importResult.data.generatedPasswords?.length > 0 && (
            <div className={styles.passwordsBlock}>
              <div className={styles.passwordsHeader}>
                <span>Сгенерированные пароли для новых пользователей</span>
                <button
                  className={styles.btnDownload}
                  onClick={() => downloadExcel(importResult.data.group?.name, importResult.data.generatedPasswords)}
                >
                  Скачать Excel
                </button>
              </div>
              <table className={styles.passwordsTable}>
                <thead>
                  <tr><th>Email</th><th>Пароль</th></tr>
                </thead>
                <tbody>
                  {importResult.data.generatedPasswords.map((r) => (
                    <tr key={r.email}>
                      <td>{r.email}</td>
                      <td className={styles.passwordCell}>{r.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        {/* Left panel */}
        <div className={styles.leftPanel}>
          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Поиск по названию..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.groupList}>
            {loading && <p className={styles.emptyList}>Загрузка...</p>}
            {!loading && !debouncedQuery.trim() && (
              <p className={styles.emptyList}>Введите название группы для поиска</p>
            )}
            {!loading && debouncedQuery.trim() && filteredGroups.length === 0 && (
              <p className={styles.emptyList}>Групп не найдено</p>
            )}
            {!loading &&
              filteredGroups.map((g) => (
                <div
                  key={g.id}
                  className={`${styles.groupItem} ${selectedGroup?.id === g.id ? styles.groupItemSelected : ''}`}
                  onClick={() => { setSelectedGroup(g); setShowCreate(false); }}
                >
                  <span className={styles.groupItemName}>{g.name}</span>
                  <span className={styles.groupItemMeta}>
                    {g.year} · {(g.members || []).length} уч.
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Right panel */}
        <div className={styles.rightPanel}>
          {showCreate && (
            <div className={styles.panelBox}>
              <h2 className={styles.panelTitle}>Новая группа</h2>
              <CreateGroupForm
                onSave={handleCreate}
                onCancel={() => setShowCreate(false)}
                loading={createLoading}
                error={createError}
              />
            </div>
          )}

          {!showCreate && selectedGroup && (
            <div className={styles.panelBox}>
              <GroupDetail
                key={selectedGroup.id}
                group={selectedGroup}
                onDeleted={() => { setSelectedGroup(null); loadGroups(false); }}
                onRefresh={() => loadGroups(true)}
              />
            </div>
          )}

          {!showCreate && !selectedGroup && (
            <div className={styles.placeholder}>
              Выберите группу или создайте новую
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
