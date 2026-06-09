import { useState, useEffect, useRef } from 'react';
import {
  getInbox, getSent, sendMessage,
  getMessageUsers, searchRecipients, setMessageRelevance,
} from '../../api/messages';
import { formatDateTime } from '../../utils/date';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/error';
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

const formatDate = formatDateTime;

// isStudent=true  → searches only users (getMessageUsers)
// isStudent=false → searches users + groups (searchRecipients)
// onSelect(id, kind) where kind = 'user' | 'group'
function RecipientInput({ isStudent, onSelect, onClear }) {
  const [inputVal, setInputVal] = useState('');
  const [isSelected, setIsSelected] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setInputVal(val);
    if (isSelected) { setIsSelected(false); onClear(); }

    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); setShowDrop(false); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = isStudent
          ? await getMessageUsers(val.trim())
          : await searchRecipients(val.trim());
        setSuggestions(res.data || []);
        setShowDrop(true);
      } catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 300);
  };

  const handleSelectItem = (item) => {
    const isGroup = item.type === 'group';
    const label = isGroup ? item.name : item.fullName;
    const kind = isGroup ? 'group' : 'user';
    setInputVal(label);
    setIsSelected(true);
    setSuggestions([]);
    setShowDrop(false);
    onSelect(item.id, kind);
  };

  const handleClear = () => {
    setInputVal('');
    setIsSelected(false);
    setSuggestions([]);
    setShowDrop(false);
    onClear();
  };

  return (
    <div className={styles.recipientWrap} ref={wrapRef}>
      <input
        type="text"
        className={`${styles.searchInput} ${isSelected ? styles.searchInputSelected : ''}`}
        placeholder="Введите имя, email или название группы..."
        value={inputVal}
        onChange={handleInput}
        autoComplete="off"
      />
      {inputVal && (
        <button type="button" className={styles.clearRecipientBtn} onMouseDown={handleClear}>
          ×
        </button>
      )}
      {showDrop && (
        <div className={styles.suggestDrop}>
          {searching && <div className={styles.searchHint}>Поиск...</div>}
          {!searching && suggestions.length === 0 && (
            <div className={styles.searchHint}>Ничего не найдено</div>
          )}
          {!searching && suggestions.map((item) => {
            const isGroup = item.type === 'group';
            return (
              <div
                key={item.id}
                className={styles.suggestItem}
                onMouseDown={() => handleSelectItem(item)}
              >
                <div className={styles.suggestName}>
                  {isGroup ? item.name : item.fullName}
                  <span className={styles.resultTypeBadge}>
                    {isGroup ? 'Группа' : (ROLE_LABELS[item.role] || item.role)}
                  </span>
                </div>
                {!isGroup && item.email && (
                  <div className={styles.suggestSub}>{item.email}</div>
                )}
                {isGroup && item.year && (
                  <div className={styles.suggestSub}>Год набора: {item.year}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
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
  const { showToast } = useToast();
  const currentUserRole = JSON.parse(localStorage.getItem('user') || '{}').role || 'student';
  const isStudent = currentUserRole === 'student';

  const [tab, setTab] = useState('inbox');
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showIrrelevant, setShowIrrelevant] = useState(false);

  const [recipientId, setRecipientId] = useState(null);
  const [recipientKind, setRecipientKind] = useState('user');
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const loadAll = () => {
    setLoading(true);
    setLoadError(false);
    Promise.all([
      getInbox().then((r) => r.data),
      getSent().then((r) => r.data),
    ])
      .then(([inboxData, sentData]) => {
        setInbox(applyLocalOverrides(inboxData));
        setSent(sentData);
      })
      .catch((err) => {
        showToast(getErrorMessage(err, 'Не удалось загрузить сообщения'));
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!showCompose) {
      setRecipientId(null);
      setRecipientKind('user');
      setMsgText('');
      setSendError('');
    }
  }, [showCompose]);

  const handleToggleRelevance = async (msgId, currentIsRelevant) => {
    const newVal = !currentIsRelevant;
    saveLocalRelevance(msgId, newVal);
    setInbox((prev) => prev.map((m) => (m.id === msgId ? { ...m, isRelevant: newVal } : m)));
    if (!newVal) setShowIrrelevant(true);
    try { await setMessageRelevance(msgId, newVal); } catch { /* localStorage already saved */ }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!recipientId) { setSendError('Выберите получателя из списка'); return; }
    if (!msgText.trim()) { setSendError('Введите текст сообщения'); return; }

    const payload = recipientKind === 'group'
      ? { groupId: recipientId, text: msgText.trim() }
      : { studentId: recipientId, text: msgText.trim() };

    setSending(true);
    setSendError('');
    try {
      await sendMessage(payload);
      setShowCompose(false);
      loadAll();
    } catch (err) {
      showToast(getErrorMessage(err, 'Ошибка при отправке сообщения'));
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
          onClick={() => setShowCompose((v) => !v)}
        >
          {showCompose ? 'Отмена' : '✏ Написать'}
        </button>
      </div>

      {showCompose && (
        <form className={styles.composeForm} onSubmit={handleSend}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              {isStudent ? 'Получатель' : 'Получатель (пользователь или группа)'}
            </label>
            <RecipientInput
              isStudent={isStudent}
              onSelect={(id, kind) => { setRecipientId(id); setRecipientKind(kind); setSendError(''); }}
              onClear={() => { setRecipientId(null); setRecipientKind('user'); }}
            />
          </div>

          <div className={styles.formRow}>
            <label className={styles.formLabel}>Сообщение</label>
            <textarea
              className={styles.textarea}
              rows={4}
              placeholder="Текст сообщения..."
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
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

      {!loading && !loadError && tab === 'inbox' && (
        <>
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

      {!loading && !loadError && tab === 'sent' && (
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
