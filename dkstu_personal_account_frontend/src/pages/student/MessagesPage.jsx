import { useState, useEffect, useRef } from 'react';
import {
  getInbox, getIrrelevantInbox, getSent as getSentApi, sendMessage,
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

const PAGE_SIZE = 10;
const EMPTY_PAGED = { data: [], total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 };

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className={styles.pagination}>
      <button
        className={styles.pageBtn}
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >‹</button>
      {getPageNumbers(page, totalPages).map((p, i) =>
        p === '...'
          ? <span key={`el-${i}`} className={styles.pageEllipsis}>…</span>
          : <button
              key={p}
              className={`${styles.pageBtn} ${p === page ? styles.pageActive : ''}`}
              onClick={() => onPageChange(p)}
            >{p}</button>
      )}
      <button
        className={styles.pageBtn}
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >›</button>
    </div>
  );
}

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
    setInputVal(isGroup ? item.name : item.fullName);
    setIsSelected(true);
    setSuggestions([]);
    setShowDrop(false);
    onSelect(item.id, isGroup ? 'group' : 'user');
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
              <div key={item.id} className={styles.suggestItem} onMouseDown={() => handleSelectItem(item)}>
                <div className={styles.suggestName}>
                  {isGroup ? item.name : item.fullName}
                  <span className={styles.resultTypeBadge}>
                    {isGroup ? 'Группа' : (ROLE_LABELS[item.role] || item.role)}
                  </span>
                </div>
                {!isGroup && item.groups?.length > 0 && (
                  <div className={styles.suggestSub}>{item.groups.map((g) => g.name).join(', ')}</div>
                )}
                {!isGroup && (item.email || item.phone) && (
                  <div className={styles.suggestSub}>{item.email || item.phone}</div>
                )}
                {isGroup && item.year && <div className={styles.suggestSub}>Год набора: {item.year}</div>}
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
          <span className={styles.msgDate}>{formatDateTime(msg.createdAt)}</span>
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

  const [relevant, setRelevant] = useState([]);
  const [relevantLoading, setRelevantLoading] = useState(true);
  const [relevantError, setRelevantError] = useState(false);

  const [irrelevant, setIrrelevant] = useState(EMPTY_PAGED);
  const [irrelevantLoaded, setIrrelevantLoaded] = useState(false);
  const [irrelevantLoading, setIrrelevantLoading] = useState(false);
  const [showIrrelevant, setShowIrrelevant] = useState(false);

  const [sent, setSent] = useState(EMPTY_PAGED);
  const [sentLoaded, setSentLoaded] = useState(false);
  const [sentLoading, setSentLoading] = useState(false);

  const [showCompose, setShowCompose] = useState(false);
  const [recipientId, setRecipientId] = useState(null);
  const [recipientKind, setRecipientKind] = useState('user');
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const loadRelevant = () => {
    setRelevantLoading(true);
    setRelevantError(false);
    getInbox()
      .then((r) => setRelevant(r.data))
      .catch((err) => {
        showToast(getErrorMessage(err, 'Не удалось загрузить входящие'));
        setRelevantError(true);
      })
      .finally(() => setRelevantLoading(false));
  };

  const loadIrrelevant = (page) => {
    setIrrelevantLoading(true);
    getIrrelevantInbox(page, PAGE_SIZE)
      .then((r) => { setIrrelevant(r.data); setIrrelevantLoaded(true); })
      .catch(() => showToast('Не удалось загрузить неактуальные сообщения'))
      .finally(() => setIrrelevantLoading(false));
  };

  const loadSent = (page) => {
    setSentLoading(true);
    getSentApi(page, PAGE_SIZE)
      .then((r) => { setSent(r.data); setSentLoaded(true); })
      .catch((err) => showToast(getErrorMessage(err, 'Не удалось загрузить отправленные')))
      .finally(() => setSentLoading(false));
  };

  useEffect(() => { loadRelevant(); }, []);

  useEffect(() => {
    if (!showCompose) {
      setRecipientId(null);
      setRecipientKind('user');
      setMsgText('');
      setSendError('');
    }
  }, [showCompose]);

  const handleTabChange = (newTab) => {
    setTab(newTab);
    if (newTab === 'sent' && !sentLoaded) loadSent(1);
  };

  const handleToggleIrrelevant = () => {
    const next = !showIrrelevant;
    setShowIrrelevant(next);
    if (next && !irrelevantLoaded) loadIrrelevant(1);
  };

  const handleToggleRelevance = async (msgId, currentIsRelevant) => {
    const newVal = !currentIsRelevant;
    if (currentIsRelevant) {
      setRelevant((prev) => prev.filter((m) => m.id !== msgId));
    } else {
      setIrrelevant((prev) => ({ ...prev, data: prev.data.filter((m) => m.id !== msgId) }));
    }
    try {
      await setMessageRelevance(msgId, newVal);
    } catch {}
    loadRelevant();
    if (currentIsRelevant) {
      setShowIrrelevant(true);
      loadIrrelevant(1);
      setIrrelevantLoaded(true);
    } else if (irrelevantLoaded) {
      loadIrrelevant(irrelevant.page);
    }
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
      loadRelevant();
      loadSent(1);
      setSentLoaded(true);
    } catch (err) {
      showToast(getErrorMessage(err, 'Ошибка при отправке сообщения'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className={styles.topRow}>
        <h1 className={s.pageTitle} style={{ margin: 0 }}>Сообщения</h1>
        <button className={styles.composeBtn} onClick={() => setShowCompose((v) => !v)}>
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
          onClick={() => handleTabChange('inbox')}
        >
          Входящие
          {relevant.length > 0 && <span className={styles.badge}>{relevant.length}</span>}
        </button>
        <button
          className={`${s.tab} ${tab === 'sent' ? s.activeTab : ''}`}
          onClick={() => handleTabChange('sent')}
        >
          Отправленные
        </button>
      </div>

      {tab === 'inbox' && (
        relevantLoading ? (
          <p className={s.empty}>Загрузка...</p>
        ) : relevantError ? (
          <p className={s.errorMsg}>Не удалось загрузить сообщения</p>
        ) : (
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

            <button className={styles.irrelevantToggle} onClick={handleToggleIrrelevant}>
              {showIrrelevant ? '▲' : '▼'} Неактуальные
              {irrelevantLoaded && irrelevant.total > 0 && (
                <span className={styles.sectionCountMuted}>{irrelevant.total}</span>
              )}
            </button>

            {showIrrelevant && (
              irrelevantLoading ? (
                <p className={s.empty}>Загрузка...</p>
              ) : irrelevant.data.length === 0 ? (
                <p className={s.empty}>Нет неактуальных сообщений</p>
              ) : (
                <>
                  <Pagination
                    page={irrelevant.page}
                    totalPages={irrelevant.totalPages}
                    onPageChange={(p) => loadIrrelevant(p)}
                  />
                  <div className={styles.msgList}>
                    {irrelevant.data.map((msg) => (
                      <MsgItem key={msg.id} msg={msg} tab="inbox" onToggleRelevance={handleToggleRelevance} />
                    ))}
                  </div>
                </>
              )
            )}
          </>
        )
      )}

      {tab === 'sent' && (
        (sentLoading || !sentLoaded) ? (
          <p className={s.empty}>Загрузка...</p>
        ) : sent.data.length === 0 ? (
          <p className={s.empty}>Нет отправленных сообщений</p>
        ) : (
          <>
            <Pagination
              page={sent.page}
              totalPages={sent.totalPages}
              onPageChange={(p) => loadSent(p)}
            />
            <div className={styles.msgList}>
              {sent.data.map((msg) => (
                <MsgItem key={msg.id} msg={msg} tab="sent" onToggleRelevance={() => {}} />
              ))}
            </div>
          </>
        )
      )}
    </div>
  );
}
