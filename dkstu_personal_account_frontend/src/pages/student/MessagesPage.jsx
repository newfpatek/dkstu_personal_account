import { useState, useEffect } from 'react';
import { getInbox, getSent, sendMessage, getMessageUsers, getMessageGroups, setMessageRelevance } from '../../api/messages';
import s from './shared.module.css';
import styles from './MessagesPage.module.css';

const ROLE_LABELS = {
  student: 'Студент',
  teacher: 'Преподаватель',
  staff: 'Сотрудник',
  admin: 'Администратор',
};

const LS_KEY = 'msgRelevance';

function loadLocalRelevance() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}

function saveLocalRelevance(msgId, val) {
  const data = loadLocalRelevance();
  data[msgId] = val;
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function applyLocalOverrides(messages) {
  const local = loadLocalRelevance();
  return messages.map((m) => ({
    ...m,
    isRelevant: m.id in local ? local[m.id] : (m.isRelevant !== false),
  }));
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  );
}

function MsgItem({ msg, tab, onToggleRelevance }) {
  const [expanded, setExpanded] = useState(false);
  const isRelevant = msg.isRelevant !== false;

  const counterpart =
    tab === 'inbox'
      ? msg.sender?.fullName || 'Система'
      : msg.recipient?.fullName || (msg.group ? `Группа: ${msg.group.name}` : '—');

  return (
    <div className={`${styles.msgItem} ${expanded ? styles.expanded : ''}`}>
      <div className={styles.msgHeader}>
        <span className={styles.msgCounterpart} onClick={() => setExpanded((v) => !v)}>
          <span className={styles.msgDirection}>{tab === 'inbox' ? 'От:' : 'Кому:'}</span>{' '}
          <strong>{counterpart}</strong>
        </span>
        <div className={styles.msgMeta}>
          <span className={styles.msgDate}>{formatDate(msg.createdAt)}</span>
          {tab === 'inbox' && (
            <button
              className={`${styles.relevanceBtn} ${isRelevant ? styles.relevanceBtnActive : styles.relevanceBtnInactive}`}
              onClick={(e) => { e.stopPropagation(); onToggleRelevance(msg.id, isRelevant); }}
            >
              {isRelevant ? 'Убрать' : 'Вернуть'}
            </button>
          )}
        </div>
      </div>
      <p
        className={`${styles.msgText} ${expanded ? styles.msgTextFull : ''}`}
        onClick={() => setExpanded((v) => !v)}
      >
        {msg.text}
      </p>
    </div>
  );
}

export default function MessagesPage() {
  const [tab, setTab] = useState('inbox');
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [showIrrelevant, setShowIrrelevant] = useState(false);
  const [recipientType, setRecipientType] = useState('user');
  const [form, setForm] = useState({ recipientId: '', text: '' });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const loadAll = () => {
    setLoading(true);
    setError('');
    Promise.all([
      getInbox().then((r) => r.data),
      getSent().then((r) => r.data),
    ])
      .then(([inboxData, sentData]) => {
        setInbox(applyLocalOverrides(inboxData));
        setSent(sentData);
      })
      .catch(() => setError('Не удалось загрузить сообщения'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
    getMessageUsers()
      .then((r) => setUsers(r.data))
      .catch(() => {});
    getMessageGroups()
      .then((r) => setGroups(r.data))
      .catch(() => {});
  }, []);

  const handleToggleRelevance = async (msgId, currentIsRelevant) => {
    const newVal = !currentIsRelevant;
    saveLocalRelevance(msgId, newVal);
    setInbox((prev) => prev.map((m) => (m.id === msgId ? { ...m, isRelevant: newVal } : m)));
    if (!newVal) setShowIrrelevant(true);
    try { await setMessageRelevance(msgId, newVal); } catch { /* no revert — localStorage already saved */ }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.recipientId) { setSendError('Выберите получателя'); return; }
    if (!form.text.trim()) { setSendError('Введите текст сообщения'); return; }

    setSending(true);
    setSendError('');
    try {
      const payload = recipientType === 'group'
        ? { groupId: form.recipientId, text: form.text.trim() }
        : { studentId: form.recipientId, text: form.text.trim() };
      await sendMessage(payload);
      setForm({ recipientId: '', text: '' });
      setShowCompose(false);
      loadAll();
    } catch (err) {
      setSendError(err.response?.data?.message || 'Ошибка при отправке');
    } finally {
      setSending(false);
    }
  };

  const relevant = inbox.filter((m) => m.isRelevant !== false);
  const irrelevant = inbox.filter((m) => m.isRelevant === false);

  return (
    <div>
      <div className={styles.topRow}>
        <h1 className={s.pageTitle} style={{ margin: 0 }}>Сообщения</h1>
        <button
          className={styles.composeBtn}
          onClick={() => { setShowCompose((v) => !v); setSendError(''); }}
        >
          {showCompose ? 'Отмена' : '✏ Написать'}
        </button>
      </div>

      {showCompose && (
        <form className={styles.composeForm} onSubmit={handleSend}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Кому</label>
            <div className={styles.recipientTypeTabs}>
              <button
                type="button"
                className={`${styles.recipientTypeBtn} ${recipientType === 'user' ? styles.recipientTypeBtnActive : ''}`}
                onClick={() => { setRecipientType('user'); setForm({ ...form, recipientId: '' }); }}
              >
                Пользователю
              </button>
              <button
                type="button"
                className={`${styles.recipientTypeBtn} ${recipientType === 'group' ? styles.recipientTypeBtnActive : ''}`}
                onClick={() => { setRecipientType('group'); setForm({ ...form, recipientId: '' }); }}
              >
                Группе
              </button>
            </div>
          </div>

          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              {recipientType === 'user' ? 'Пользователь' : 'Группа'}
            </label>
            {recipientType === 'user' ? (
              <select
                className={styles.select}
                value={form.recipientId}
                onChange={(e) => setForm({ ...form, recipientId: e.target.value })}
              >
                <option value="">— выберите пользователя —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({ROLE_LABELS[u.role] || u.role})
                  </option>
                ))}
              </select>
            ) : (
              <select
                className={styles.select}
                value={form.recipientId}
                onChange={(e) => setForm({ ...form, recipientId: e.target.value })}
              >
                <option value="">— выберите группу —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className={styles.formRow}>
            <label className={styles.formLabel}>Сообщение</label>
            <textarea
              className={styles.textarea}
              rows={4}
              placeholder="Текст сообщения..."
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
            />
          </div>

          {sendError && <p className={s.errorMsg}>{sendError}</p>}

          <button className={styles.sendBtn} type="submit" disabled={sending}>
            {sending ? 'Отправка...' : 'Отправить'}
          </button>
        </form>
      )}

      <div className={s.tabs}>
        <button
          className={`${s.tab} ${tab === 'inbox' ? s.activeTab : ''}`}
          onClick={() => setTab('inbox')}
        >
          Входящие
          {relevant.length > 0 && <span className={styles.badge}>{relevant.length}</span>}
        </button>
        <button
          className={`${s.tab} ${tab === 'sent' ? s.activeTab : ''}`}
          onClick={() => setTab('sent')}
        >
          Отправленные
        </button>
      </div>

      {loading && <p className={s.empty}>Загрузка...</p>}
      {error && <p className={s.errorMsg}>{error}</p>}

      {!loading && !error && tab === 'inbox' && (
        <>
          {/* Актуальные */}
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Актуальные</span>
            <span className={styles.sectionCount}>{relevant.length}</span>
          </div>

          {relevant.length === 0 ? (
            <p className={s.empty}>Нет актуальных сообщений</p>
          ) : (
            <div className={styles.msgList}>
              {relevant.map((msg) => (
                <MsgItem key={msg.id} msg={msg} tab="inbox" onToggleRelevance={handleToggleRelevance} />
              ))}
            </div>
          )}

          {/* Неактуальные */}
          <button
            className={styles.irrelevantToggle}
            onClick={() => setShowIrrelevant((v) => !v)}
          >
            {showIrrelevant ? '▲' : '▼'} Неактуальные
            {irrelevant.length > 0 && (
              <span className={styles.sectionCountMuted}>{irrelevant.length}</span>
            )}
          </button>

          {showIrrelevant && (
            irrelevant.length === 0 ? (
              <p className={s.empty}>Нет неактуальных сообщений</p>
            ) : (
              <div className={styles.msgList}>
                {irrelevant.map((msg) => (
                  <MsgItem key={msg.id} msg={msg} tab="inbox" onToggleRelevance={handleToggleRelevance} />
                ))}
              </div>
            )
          )}
        </>
      )}

      {!loading && !error && tab === 'sent' && (
        sent.length === 0 ? (
          <p className={s.empty}>Нет отправленных сообщений</p>
        ) : (
          <div className={styles.msgList}>
            {sent.map((msg) => (
              <MsgItem key={msg.id} msg={msg} tab="sent" onToggleRelevance={() => {}} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
