import { useState, useEffect, useRef } from 'react';
import {
  getUsers,
  getBaseAmounts,
  setBaseAmount,
  getStudentScholarships,
  assignScholarship,
  updateScholarship,
  deleteScholarship,
  importScholarships,
} from '../../api/admin';
import { getStudentAllGrades } from '../../api/staff';
import { formatDate } from '../../utils/date';
import s from '../student/shared.module.css';
import adminStyles from './AdminUsersPage.module.css';
import styles from './AdminScholarshipsPage.module.css';

const SCHOLARSHIP_TYPES = [
  { value: 'academic', label: 'Академическая' },
  { value: 'social', label: 'Социальная' },
  { value: 'enhanced_academic', label: 'Повышенная академическая' },
  { value: 'academic_coeff_1_4', label: 'Академическая (коэф. 1.4)' },
  { value: 'academic_coeff_1_5', label: 'Академическая (коэф. 1.5)' },
  { value: 'enhanced_social', label: 'Повышенная социальная' },
];

const TYPE_LABELS = Object.fromEntries(SCHOLARSHIP_TYPES.map((t) => [t.value, t.label]));

const DIRECTIONS = [
  { value: 'academic', label: 'Учебная деятельность' },
  { value: 'research', label: 'Научная деятельность' },
  { value: 'social', label: 'Общественная деятельность' },
  { value: 'sports', label: 'Спортивная деятельность' },
  { value: 'cultural', label: 'Культурная деятельность' },
];

const DIRECTION_LABELS = Object.fromEntries(DIRECTIONS.map((d) => [d.value, d.label]));

function formatAmount(amount) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(amount);
}

function getBaseForType(type, direction, baseAmounts) {
  if (type === 'academic_coeff_1_4' || type === 'academic_coeff_1_5') {
    const academic = baseAmounts.find((b) => b.type === 'academic' && !b.direction);
    if (!academic) return undefined;
    const coeff = type === 'academic_coeff_1_4' ? 1.4 : 1.5;
    return Math.round(Number(academic.amount) * coeff * 100) / 100;
  }
  if (type === 'enhanced_academic' && direction) {
    const entry = baseAmounts.find((b) => b.type === 'enhanced_academic' && b.direction === direction);
    return entry ? Number(entry.amount) : undefined;
  }
  const entry = baseAmounts.find((b) => b.type === type && !b.direction);
  return entry ? Number(entry.amount) : undefined;
}

// ─── Scholarship form ─────────────────────────────────────────────────────────

function ScholarshipForm({ initial, hasDebts, baseAmounts, onSave, onCancel, loading, error }) {
  const defaultType = hasDebts ? 'social' : 'academic';
  const [form, setForm] = useState(
    initial
      ? {
          type: initial.type,
          direction: initial.direction || (initial.type === 'enhanced_academic' ? 'academic' : ''),
          amount: initial.amount !== undefined ? String(initial.amount) : '',
          periodStart: initial.periodStart ? initial.periodStart.slice(0, 10) : '',
          periodEnd: initial.periodEnd ? initial.periodEnd.slice(0, 10) : '',
          isActive: initial.isActive !== undefined ? initial.isActive : true,
        }
      : { type: defaultType, direction: '', amount: '', periodStart: '', periodEnd: '', isActive: true },
  );

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const baseAmount = getBaseForType(form.type, form.direction || null, baseAmounts);
  const isCoeff = form.type === 'academic_coeff_1_4' || form.type === 'academic_coeff_1_5';
  const needsDirection = form.type === 'enhanced_academic' || form.type === 'enhanced_social';

  const availableTypes = hasDebts && !initial
    ? SCHOLARSHIP_TYPES.filter((t) => t.value === 'social')
    : SCHOLARSHIP_TYPES;

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {};
    if (!initial) {
      payload.type = form.type;
      payload.periodStart = form.periodStart;
      if (form.direction) payload.direction = form.direction;
      if (form.amount !== '') payload.amount = Number(form.amount);
      if (form.periodEnd) payload.periodEnd = form.periodEnd;
    } else {
      if (form.periodStart) payload.periodStart = form.periodStart;
      payload.direction = form.direction || null;
      if (form.amount !== '') payload.amount = Number(form.amount);
      payload.periodEnd = form.periodEnd || null;
      payload.isActive = form.isActive;
    }
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className={adminStyles.form}>
      {!initial && (
        <div className={adminStyles.formRow}>
          <label className={adminStyles.label}>Вид стипендии</label>
          <select
            className={adminStyles.select}
            value={form.type}
            onChange={(e) => {
              const newType = e.target.value;
              set('type', newType);
              set('direction', newType === 'enhanced_academic' ? 'academic' : '');
            }}
          >
            {availableTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      )}
      {needsDirection && (
        <div className={adminStyles.formRow}>
          <label className={adminStyles.label}>Направление</label>
          <select
            className={adminStyles.select}
            value={form.direction}
            onChange={(e) => set('direction', e.target.value)}
          >
            {form.type !== 'enhanced_academic' && <option value="">Не указано</option>}
            {DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      )}
      <div className={adminStyles.formRow}>
        <label className={adminStyles.label}>
          Сумма (₽)
          {isCoeff && baseAmount !== undefined && (
            <span style={{ color: '#16a34a', marginLeft: 6 }}>
              авто: {formatAmount(baseAmount)}
            </span>
          )}
          {!isCoeff && baseAmount !== undefined && ` — базовый: ${formatAmount(baseAmount)}`}
        </label>
        <input
          className={adminStyles.input}
          type="number"
          min="0"
          step="0.01"
          value={form.amount}
          onChange={(e) => set('amount', e.target.value)}
          placeholder={
            isCoeff && baseAmount !== undefined
              ? `Авто: ${baseAmount}`
              : baseAmount !== undefined
              ? `По умолчанию: ${baseAmount}`
              : 'Обязательно'
          }
          required={baseAmount === undefined && !initial && !isCoeff}
        />
      </div>
      <div className={adminStyles.formRow}>
        <label className={adminStyles.label}>Начало периода</label>
        <input
          className={adminStyles.input}
          type="date"
          value={form.periodStart}
          onChange={(e) => set('periodStart', e.target.value)}
          required={!initial}
        />
      </div>
      <div className={adminStyles.formRow}>
        <label className={adminStyles.label}>Конец периода</label>
        <input
          className={adminStyles.input}
          type="date"
          value={form.periodEnd}
          onChange={(e) => set('periodEnd', e.target.value)}
        />
      </div>
      {initial && (
        <div className={adminStyles.formRow}>
          <label className={adminStyles.checkLabel}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
            />
            Активна
          </label>
        </div>
      )}
      {error && <p className={s.errorMsg}>{error}</p>}
      <div className={adminStyles.formActions}>
        <button type="submit" className={adminStyles.btnPrimary} disabled={loading}>
          {loading ? 'Сохранение...' : initial ? 'Сохранить' : 'Назначить'}
        </button>
        <button type="button" className={adminStyles.btnSecondary} onClick={onCancel} disabled={loading}>
          Отмена
        </button>
      </div>
    </form>
  );
}

// ─── Base amounts panel ───────────────────────────────────────────────────────

function BaseAmountRow({ label, type, direction, baseAmounts, onRefresh }) {
  const current = baseAmounts.find(
    (b) => b.type === type && (direction ? b.direction === direction : !b.direction),
  );
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    setValue(current ? String(current.amount) : '');
    setEditing(true);
  };

  const handleSave = async () => {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount < 0) return;
    setSaving(true);
    try {
      await setBaseAmount({ type, amount, direction: direction || null });
      await onRefresh();
      setEditing(false);
    } catch { } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.baseAmountItem}>
      <span className={styles.baseAmountLabel}>{label}</span>
      {editing ? (
        <div className={styles.baseAmountEdit}>
          <input
            className={styles.baseAmountInput}
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <button
            className={adminStyles.btnPrimary}
            disabled={saving}
            onClick={handleSave}
            style={{ padding: '5px 10px', fontSize: 13 }}
          >
            {saving ? '...' : 'Сохранить'}
          </button>
          <button
            className={adminStyles.btnSecondary}
            onClick={() => setEditing(false)}
            style={{ padding: '5px 10px', fontSize: 13 }}
          >
            Отмена
          </button>
        </div>
      ) : (
        <div className={styles.baseAmountValue}>
          <span>{current ? formatAmount(current.amount) : '—'}</span>
          <button
            className={adminStyles.btnSecondary}
            onClick={handleEdit}
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            Изменить
          </button>
        </div>
      )}
    </div>
  );
}

function BaseAmountsPanel({ baseAmounts, onRefresh }) {
  const academicBase = baseAmounts.find((b) => b.type === 'academic' && !b.direction);
  const coeff14 = academicBase ? Math.round(Number(academicBase.amount) * 1.4 * 100) / 100 : null;
  const coeff15 = academicBase ? Math.round(Number(academicBase.amount) * 1.5 * 100) / 100 : null;

  return (
    <div className={styles.baseAmountsGrid}>
      <BaseAmountRow label="Академическая" type="academic" direction={null} baseAmounts={baseAmounts} onRefresh={onRefresh} />

      <div className={styles.baseAmountItem}>
        <span className={styles.baseAmountLabel} style={{ opacity: 0.65 }}>
          Академическая (коэф. 1.4) — авто
        </span>
        <div className={styles.baseAmountValue}>
          <span className={styles.baseAmountCalc}>
            {coeff14 !== null ? formatAmount(coeff14) : '—'}
          </span>
        </div>
      </div>
      <div className={styles.baseAmountItem}>
        <span className={styles.baseAmountLabel} style={{ opacity: 0.65 }}>
          Академическая (коэф. 1.5) — авто
        </span>
        <div className={styles.baseAmountValue}>
          <span className={styles.baseAmountCalc}>
            {coeff15 !== null ? formatAmount(coeff15) : '—'}
          </span>
        </div>
      </div>

      <BaseAmountRow label="Социальная" type="social" direction={null} baseAmounts={baseAmounts} onRefresh={onRefresh} />
      <BaseAmountRow label="Повышенная социальная" type="enhanced_social" direction={null} baseAmounts={baseAmounts} onRefresh={onRefresh} />

      <div className={styles.baseAmountSection}>
        <div className={styles.baseAmountSectionTitle}>Повышенная академическая — по направлениям</div>
        {DIRECTIONS.map((d) => (
          <BaseAmountRow
            key={d.value}
            label={d.label}
            type="enhanced_academic"
            direction={d.value}
            baseAmounts={baseAmounts}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminScholarshipsPage() {
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [scholarships, setScholarships] = useState([]);
  const [hasDebts, setHasDebts] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [baseAmounts, setBaseAmounts] = useState([]);
  const [showBase, setShowBase] = useState(false);
  const [mode, setMode] = useState(null); // null | 'create' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // Load only non-contract students
  useEffect(() => {
    setStudentsLoading(true);
    getUsers('student')
      .then((r) => setStudents((r.data || []).filter((u) => !u.isPaid)))
      .catch(() => {})
      .finally(() => setStudentsLoading(false));
  }, []);

  const loadBaseAmounts = () =>
    getBaseAmounts().then((r) => setBaseAmounts(r.data)).catch(() => {});

  useEffect(() => { loadBaseAmounts(); }, []);

  useEffect(() => {
    if (!selectedStudent) return;
    setDetailLoading(true);
    setScholarships([]);
    setHasDebts(false);
    setMode(null);
    setEditingId(null);
    setFormError('');
    Promise.all([
      getStudentScholarships(selectedStudent.id),
      getStudentAllGrades(selectedStudent.id),
    ])
      .then(([schRes, gradesRes]) => {
        setScholarships(schRes.data);
        setHasDebts((gradesRes.data || []).some((g) => g.isDebt));
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [selectedStudent?.id]);

  const reloadScholarships = () =>
    getStudentScholarships(selectedStudent.id)
      .then((r) => setScholarships(r.data))
      .catch(() => {});

  const [debouncedQuery, setDebouncedQuery] = useState('');
  const queryDebounceRef = useRef(null);

  useEffect(() => {
    if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current);
    queryDebounceRef.current = setTimeout(() => setDebouncedQuery(query), 1000);
    return () => clearTimeout(queryDebounceRef.current);
  }, [query]);

  const filteredStudents = debouncedQuery.trim()
    ? students.filter((u) => {
        const q = debouncedQuery.toLowerCase();
        return u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
      })
    : [];

  const handleCreate = async (payload) => {
    setFormLoading(true);
    setFormError('');
    try {
      await assignScholarship(selectedStudent.id, payload);
      await reloadScholarships();
      setMode(null);
    } catch (e) {
      setFormError(e.response?.data?.message || 'Ошибка при назначении стипендии');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (payload) => {
    setFormLoading(true);
    setFormError('');
    try {
      await updateScholarship(selectedStudent.id, editingId, payload);
      await reloadScholarships();
      setMode(null);
      setEditingId(null);
    } catch (e) {
      setFormError(e.response?.data?.message || 'Ошибка при сохранении');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (sc) => {
    if (!window.confirm(`Удалить запись о стипендии «${TYPE_LABELS[sc.type] || sc.type}»?`)) return;
    try {
      await deleteScholarship(selectedStudent.id, sc.id);
      await reloadScholarships();
    } catch (e) {
      alert(e.response?.data?.message || 'Ошибка при удалении');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await importScholarships(file);
      setImportResult(res.data);
      if (selectedStudent) await reloadScholarships();
    } catch (err) {
      setImportResult({ error: err.response?.data?.message || 'Ошибка импорта' });
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  };

  const initials = selectedStudent?.fullName
    ? selectedStudent.fullName.split(' ').slice(0, 2).map((p) => p[0]).join('')
    : '?';

  const editingScholarship = scholarships.find((sc) => sc.id === editingId) ?? null;

  return (
    <div>
      <div className={adminStyles.pageHeader}>
        <h1 className={s.pageTitle} style={{ margin: 0 }}>Стипендии</h1>
        <div className={adminStyles.headerActions}>
          <button
            className={adminStyles.btnSecondary}
            onClick={() => setShowBase((v) => !v)}
          >
            {showBase ? 'Скрыть базовые размеры' : 'Базовые размеры стипендий'}
          </button>
          <button
            className={adminStyles.btnSecondary}
            onClick={() => { setImportResult(null); fileInputRef.current?.click(); }}
            disabled={importLoading}
          >
            {importLoading ? 'Импорт...' : 'Импорт из файла'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.xml,.xlsx"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
      </div>

      {importResult && (
        <div className={importResult.error ? adminStyles.importError : adminStyles.importSuccess}>
          {importResult.error
            ? importResult.error
            : `Назначено: ${importResult.created} · Пропущено: ${importResult.skipped}${importResult.errors?.length ? ` · Ошибок: ${importResult.errors.length}` : ''}`}
          {importResult.errors?.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12 }}>
              {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
        </div>
      )}

      {showBase && (
        <div className={styles.basePanel}>
          <div className={styles.basePanelTitle}>Базовые размеры стипендий</div>
          <BaseAmountsPanel baseAmounts={baseAmounts} onRefresh={loadBaseAmounts} />
        </div>
      )}

      <div className={adminStyles.splitLayout}>
        {/* Left panel */}
        <div className={adminStyles.leftPanel}>
          <div className={adminStyles.searchWrap}>
            <input
              className={adminStyles.searchInput}
              type="text"
              placeholder="Поиск по имени или email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={adminStyles.userList}>
            {studentsLoading && <p className={adminStyles.emptyList}>Загрузка...</p>}
            {!studentsLoading && !debouncedQuery.trim() && (
              <p className={adminStyles.emptyList}>Введите имя или email для поиска</p>
            )}
            {!studentsLoading && debouncedQuery.trim() && filteredStudents.length === 0 && (
              <p className={adminStyles.emptyList}>Студентов не найдено</p>
            )}
            {!studentsLoading &&
              filteredStudents.map((u) => (
                <div
                  key={u.id}
                  className={`${adminStyles.userItem} ${u.id === selectedStudent?.id ? adminStyles.userItemSelected : ''}`}
                  onClick={() => {
                    setSelectedStudent(u);
                    setMode(null);
                    setEditingId(null);
                    setFormError('');
                    setImportResult(null);
                  }}
                >
                  <span className={adminStyles.userName}>{u.fullName}</span>
                  <span className={adminStyles.userEmail}>{u.email}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Right panel */}
        <div className={adminStyles.rightPanel}>
          {!selectedStudent && (
            <div className={adminStyles.placeholder}>Выберите студента из списка</div>
          )}

          {selectedStudent && (
            <div className={adminStyles.panelBox}>
              <div className={adminStyles.profileHeader}>
                <div className={adminStyles.profileAvatar}>{initials}</div>
                <div className={adminStyles.profileInfo}>
                  <span className={adminStyles.profileFullName}>{selectedStudent.fullName}</span>
                  <span className={adminStyles.profileEmail}>{selectedStudent.email}</span>
                </div>
              </div>

              {hasDebts && (
                <div className={styles.warningBox}>
                  У студента есть академические задолженности — доступна только социальная стипендия.
                </div>
              )}

              {detailLoading ? (
                <p className={s.empty}>Загрузка...</p>
              ) : (
                <>
                  {scholarships.length === 0 && mode !== 'create' && (
                    <p className={s.empty} style={{ marginBottom: 16 }}>Стипендий не назначено</p>
                  )}

                  {scholarships.map((sc) =>
                    mode === 'edit' && editingId === sc.id ? (
                      <div key={sc.id} className={styles.scholarshipCard}>
                        <div className={styles.schCardTitle}>{TYPE_LABELS[sc.type] || sc.type}</div>
                        <ScholarshipForm
                          initial={editingScholarship}
                          hasDebts={false}
                          baseAmounts={baseAmounts}
                          onSave={handleUpdate}
                          onCancel={() => { setMode(null); setEditingId(null); setFormError(''); }}
                          loading={formLoading}
                          error={formError}
                        />
                      </div>
                    ) : (
                      <div key={sc.id} className={styles.scholarshipCard}>
                        <div className={styles.schCardHeader}>
                          <span className={styles.schType}>{TYPE_LABELS[sc.type] || sc.type}</span>
                          <span
                            className={styles.schStatus}
                            style={{ color: sc.isActive ? '#16a34a' : '#9ca3af' }}
                          >
                            {sc.isActive ? '● Активна' : '○ Завершена'}
                          </span>
                        </div>
                        {sc.direction && (
                          <div className={styles.schMeta}>
                            {DIRECTION_LABELS[sc.direction] || sc.direction}
                          </div>
                        )}
                        <div className={styles.schAmount}>{formatAmount(sc.amount)}</div>
                        <div className={styles.schMeta}>
                          с {formatDate(sc.periodStart)}
                          {sc.periodEnd && ` по ${formatDate(sc.periodEnd)}`}
                        </div>
                        <div className={styles.schActions}>
                          <button
                            className={adminStyles.btnSecondary}
                            style={{ padding: '5px 12px', fontSize: 13 }}
                            onClick={() => {
                              setMode('edit');
                              setEditingId(sc.id);
                              setFormError('');
                            }}
                            disabled={mode === 'create'}
                          >
                            Изменить
                          </button>
                          <button
                            className={adminStyles.btnDanger}
                            style={{ padding: '5px 12px', fontSize: 13 }}
                            onClick={() => handleDelete(sc)}
                            disabled={mode === 'create' || mode === 'edit'}
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    ),
                  )}

                  {mode === 'create' ? (
                    <div className={styles.addFormWrap}>
                      <div className={styles.addFormTitle}>Новая запись о стипендии</div>
                      <ScholarshipForm
                        initial={null}
                        hasDebts={hasDebts}
                        baseAmounts={baseAmounts}
                        onSave={handleCreate}
                        onCancel={() => { setMode(null); setFormError(''); }}
                        loading={formLoading}
                        error={formError}
                      />
                    </div>
                  ) : (
                    mode !== 'edit' && (
                      <button
                        className={adminStyles.btnPrimary}
                        style={{ marginTop: scholarships.length > 0 ? 4 : 0 }}
                        onClick={() => { setMode('create'); setFormError(''); }}
                      >
                        + Назначить стипендию
                      </button>
                    )
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
