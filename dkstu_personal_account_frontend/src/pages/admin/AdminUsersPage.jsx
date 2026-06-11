import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  importUsers,
} from '../../api/admin';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/error';
import s from '../student/shared.module.css';
import styles from './AdminUsersPage.module.css';

const ROLES = [
  { value: '', label: 'Все' },
  { value: 'student', label: 'Студенты' },
  { value: 'teacher', label: 'Преподаватели' },
  { value: 'staff', label: 'Сотрудники' },
  { value: 'admin', label: 'Администраторы' },
];

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

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  gradeBook: '',
  password: '',
  role: 'student',
  isPaid: false,
};

function downloadExcel(rows, filename) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 36 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Пароли');
  XLSX.writeFile(wb, filename);
}

function PasswordModal({ phone, password, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Пользователь создан</h3>
        <p className={styles.modalHint}>Запишите пароль — он больше не будет показан.</p>
        <div className={styles.modalRow}>
          <span className={styles.modalLabel}>Телефон:</span>
          <span className={styles.modalValue}>{phone}</span>
        </div>
        <div className={styles.modalRow}>
          <span className={styles.modalLabel}>Пароль:</span>
          <span className={styles.modalPassword}>{password}</span>
          <button className={styles.btnCopy} onClick={handleCopy}>
            {copied ? '✓ Скопировано' : 'Скопировать'}
          </button>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btnPrimary} onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

function UserForm({ initial, onSave, onCancel, loading, error }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    if (initial) delete payload.role;
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formRow}>
        <label className={styles.label}>ФИО<span style={{ color: '#dc2626' }}> *</span></label>
        <input
          className={styles.input}
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          required
          placeholder="ФИО..."
          autoComplete="off"
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.label}>Телефон<span style={{ color: '#dc2626' }}> *</span></label>
        <input
          className={styles.input}
          type="tel"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          required={!initial}
          placeholder="Номер телефона... (формат: +71234567890)"
          autoComplete="off"
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.label}>Электронная почта</label>
        <input
          className={styles.input}
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="Email... (формат: example@mail.ru)"
          autoComplete="off"
        />
      </div>
      {initial && (
        <div className={styles.formRow}>
          <label className={styles.label}>Новый пароль</label>
          <input
            className={styles.input}
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            placeholder="Если не хотите менять пароль, оставьте поле пустым"
            autoComplete="new-password"
          />
        </div>
      )}
      {!initial && (
        <div className={styles.formRow}>
          <label className={styles.label}>Роль пользователя</label>
          <select
            className={styles.select}
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
          >
            <option value="student">Студент</option>
            <option value="teacher">Преподаватель</option>
            <option value="staff">Сотрудник</option>
            <option value="admin">Администратор</option>
          </select>
        </div>
      )}
      {form.role === 'student' && (
        <>
          <div className={styles.formRow}>
            <label className={styles.label}>
              Номер зачётной книжки{!initial && <span style={{ color: '#dc2626' }}> *</span>}
            </label>
            <input
              className={styles.input}
              value={form.gradeBook || ''}
              onChange={(e) => set('gradeBook', e.target.value)}
              required={!initial}
              placeholder="Номер зачетной книжки... (формат: 12345)"
              maxLength={50}
              autoComplete="off"
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={form.isPaid}
                onChange={(e) => set('isPaid', e.target.checked)}
              />
              Студент находится на платном обучении
            </label>
          </div>
        </>
      )}
      {error && <p className={s.errorMsg}>{error}</p>}
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={loading}>
          {loading ? 'Сохранение...' : initial ? 'Сохранить' : 'Создать'}
        </button>
        <button type="button" className={styles.btnSecondary} onClick={onCancel} disabled={loading}>
          Отмена
        </button>
      </div>
    </form>
  );
}

function UserDetail({ user, onEdit, onDelete }) {
  const initials = user.fullName
    ? user.fullName.split(' ').slice(0, 2).map((p) => p[0]).join('')
    : '?';

  return (
    <div>
      <div className={styles.profileHeader}>
        <div className={styles.profileAvatar}>{initials}</div>
        <div className={styles.profileInfo}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className={styles.profileFullName}>{user.fullName}</span>
            {user.groups?.map((g) => (
              <span key={g.id} className={styles.groupTag}>{g.name}</span>
            ))}
          </div>
          <span className={styles.profileEmail}>{user.phone}</span>
          {user.email && <span className={styles.profileEmail}>{user.email}</span>}
          {user.gradeBook && <span className={styles.profileEmail}>Зачетная книжка {user.gradeBook}</span>}
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span
              className={styles.roleBadge}
              style={{
                background: `${ROLE_COLORS[user.role]}18`,
                color: ROLE_COLORS[user.role],
              }}
            >
              {ROLE_LABELS[user.role] || user.role}
            </span>
            {user.isPaid && (
              <span className={styles.paidTag}>Контрактник</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.detailActions}>
        <button className={styles.btnPrimary} onClick={onEdit}>
          Редактировать
        </button>
        <button className={styles.btnDanger} onClick={onDelete}>
          Удалить
        </button>
      </div>
    </div>
  );
}

function ImportResult({ result, onClose }) {
  if (result.error) {
    return (
      <div className={styles.importError}>
        {result.error}
        <button className={styles.importClose} onClick={onClose}>✕</button>
      </div>
    );
  }

  const hasPasswords = result.generatedPasswords?.length > 0;

  const handleDownload = () => {
    const rows = result.generatedPasswords.map((r) => ({
      ФИО: r.fullName,
      Телефон: r.phone,
      Пароль: r.password,
    }));
    downloadExcel(rows, 'passwords.xlsx');
  };

  return (
    <div className={styles.importSuccess}>
      <div className={styles.importSummary}>
        <span>
          Создано: <b>{result.created}</b> · Пропущено: <b>{result.skipped}</b>
          {result.errors?.length > 0 && <> · Ошибок: <b>{result.errors.length}</b></>}
        </span>
        <button className={styles.importClose} onClick={onClose}>✕</button>
      </div>

      {result.errors?.length > 0 && (
        <ul className={styles.importErrors}>
          {result.errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}

      {hasPasswords && (
        <div className={styles.passwordsBlock}>
          <div className={styles.passwordsHeader}>
            <span>Сгенерированные пароли</span>
            <button className={styles.btnDownload} onClick={handleDownload}>
              Скачать Excel
            </button>
          </div>
          <table className={styles.passwordsTable}>
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Телефон</th>
                <th>Пароль</th>
              </tr>
            </thead>
            <tbody>
              {result.generatedPasswords.map((r) => (
                <tr key={r.phone}>
                  <td>{r.fullName}</td>
                  <td>{r.phone}</td>
                  <td className={styles.passwordCell}>{r.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const { showToast } = useToast();
  const [roleFilter, setRoleFilter] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [mode, setMode] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [passwordModal, setPasswordModal] = useState(null);
  const fileInputRef = useRef(null);

  const loadUsers = (role) => {
    setLoading(true);
    getUsers(role || undefined)
      .then((r) => setUsers(r.data))
      .catch((err) => showToast(getErrorMessage(err, 'Не удалось загрузить пользователей')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers(roleFilter);
  }, [roleFilter]);

  const [debouncedQuery, setDebouncedQuery] = useState('');
  const queryDebounceRef = useRef(null);

  useEffect(() => {
    if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current);
    queryDebounceRef.current = setTimeout(() => setDebouncedQuery(query), 1000);
    return () => clearTimeout(queryDebounceRef.current);
  }, [query]);

  const filteredUsers = debouncedQuery.trim()
    ? users.filter((u) => {
        const q = debouncedQuery.trim().toLowerCase();
        return (
          u.fullName?.toLowerCase().includes(q) ||
          u.phone?.includes(q) ||
          u.email?.toLowerCase().includes(q)
        );
      })
    : [];

  const handleSelect = (user) => {
    setSelectedId(user.id);
    setSelectedUser(user);
    setMode(null);
    setImportResult(null);
  };

  const handleCreate = async (payload) => {
    setFormLoading(true);
    try {
      const res = await createUser(payload);
      loadUsers(roleFilter);
      setMode(null);
      if (res.data.generatedPassword) {
        setPasswordModal({ phone: res.data.phone, password: res.data.generatedPassword });
      }
    } catch (e) {
      showToast(getErrorMessage(e, 'Ошибка при создании пользователя'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (payload) => {
    setFormLoading(true);
    try {
      await updateUser(selectedId, payload);
      loadUsers(roleFilter);
      setMode(null);
    } catch (e) {
      showToast(getErrorMessage(e, 'Ошибка при сохранении'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Удалить пользователя «${selectedUser.fullName}»?`)) return;
    try {
      await deleteUser(selectedId);
      setSelectedId(null);
      setSelectedUser(null);
      loadUsers(roleFilter);
    } catch (e) {
      showToast(getErrorMessage(e, 'Ошибка при удалении'));
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await importUsers(file);
      setImportResult(res.data);
      loadUsers(roleFilter);
    } catch (err) {
      setImportResult({ error: err.response?.data?.message || 'Ошибка импорта' });
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  };

  const editInitial = selectedUser
    ? { name: selectedUser.fullName, phone: selectedUser.phone || '', email: selectedUser.email || '', gradeBook: selectedUser.gradeBook || '', password: '', role: selectedUser.role, isPaid: selectedUser.isPaid || false }
    : null;

  return (
    <div>
      {passwordModal && (
        <PasswordModal
          email={passwordModal.email}
          password={passwordModal.password}
          onClose={() => setPasswordModal(null)}
        />
      )}

      <div className={styles.pageHeader}>
        <h1 className={s.pageTitle} style={{ margin: 0 }}>
          Пользователи
        </h1>
        <div className={styles.headerActions}>
          <button
            className={styles.btnSecondary}
            onClick={() => { setImportResult(null); fileInputRef.current?.click(); }}
            disabled={importLoading}
          >
            {importLoading ? 'Импорт...' : 'Импорт из файла'}
          </button>
          <button
            className={styles.btnPrimary}
            onClick={() => { setMode('create'); setSelectedId(null); setSelectedUser(null); setFormError(''); setImportResult(null); }}
          >
            + Создать пользователя
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
        <ImportResult result={importResult} onClose={() => setImportResult(null)} />
      )}

      {/* <div className={styles.roleTabs}>
        {ROLES.map((r) => (
          <button
            key={r.value}
            className={`${styles.roleTab} ${roleFilter === r.value ? styles.roleTabActive : ''}`}
            onClick={() => { setRoleFilter(r.value); setSelectedId(null); setSelectedUser(null); setMode(null); }}
          >
            {r.label}
          </button>
        ))}
      </div> */}

      <div className={styles.splitLayout}>
        <div className={styles.leftPanel}>
          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Поиск по имени, телефону или email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.userList}>
            {loading && <p className={styles.emptyList}>Загрузка...</p>}
            {!loading && !debouncedQuery.trim() && (
              <p className={styles.emptyList}>Введите имя или email для поиска</p>
            )}
            {!loading && debouncedQuery.trim() && filteredUsers.length === 0 && (
              <p className={styles.emptyList}>Пользователей не найдено</p>
            )}
            {!loading &&
              filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className={`${styles.userItem} ${u.id === selectedId ? styles.userItemSelected : ''}`}
                  onClick={() => handleSelect(u)}
                >
                  <span className={styles.userName}>
                    {u.fullName}
                    {u.groups?.map((g) => (
                      <span key={g.id} className={styles.groupTag}>{g.name}</span>
                    ))}
                    {u.isPaid && <span className={styles.paidTag}>Контракт</span>}
                  </span>
                  <span
                    className={styles.userRole}
                    style={{ color: ROLE_COLORS[u.role] }}
                  >
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                  {(u.email || u.phone) && (
                    <span className={styles.userEmail}>{u.email || u.phone}</span>
                  )}
                </div>
              ))}
          </div>
        </div>

        <div className={styles.rightPanel}>
          {mode === 'create' && (
            <div className={styles.panelBox}>
              <h2 className={styles.panelTitle}>Новый пользователь</h2>
              <UserForm
                initial={null}
                onSave={handleCreate}
                onCancel={() => setMode(null)}
                loading={formLoading}
                error=""
              />
            </div>
          )}

          {mode === 'edit' && selectedUser && (
            <div className={styles.panelBox}>
              <h2 className={styles.panelTitle}>Редактирование</h2>
              <UserForm
                initial={editInitial}
                onSave={handleUpdate}
                onCancel={() => setMode(null)}
                loading={formLoading}
                error=""
              />
            </div>
          )}

          {mode === null && selectedUser && (
            <div className={styles.panelBox}>
              <UserDetail
                user={selectedUser}
                onEdit={() => { setMode('edit'); setFormError(''); }}
                onDelete={handleDelete}
              />
            </div>
          )}

          {mode === null && !selectedUser && (
            <div className={styles.placeholder}>
              Выберите пользователя или создайте нового
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
