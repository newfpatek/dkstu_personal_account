import { useState, useEffect, useRef } from 'react';
import { getPortfolio, uploadPortfolioItem, deletePortfolioItem, fetchPortfolioFile } from '../../api/students';
import { formatDateShort as formatDate } from '../../utils/date';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/error';
import s from './shared.module.css';
import styles from './PortfolioPage.module.css';

const CATEGORIES = [
  { value: '', label: 'Все категории' },
  { value: 'academic', label: 'Учебная' },
  { value: 'research', label: 'Научная' },
  { value: 'social', label: 'Общественная' },
  { value: 'sports', label: 'Спортивная' },
  { value: 'cultural', label: 'Культурная' },
];

const CATEGORY_COLORS = {
  academic: '#2563eb',
  research: '#7c3aed',
  social: '#16a34a',
  sports: '#d97706',
  cultural: '#db2777',
};

const PAGE_SIZE = 10;

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
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

export default function PortfolioPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [fileLoadingId, setFileLoadingId] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({ title: '', category: 'academic', description: '' });
  const fileRef = useRef(null);

  const load = (cat) => {
    setLoading(true);
    setLoadError(false);
    getPortfolio(cat || undefined)
      .then((res) => setItems(res.data))
      .catch((err) => {
        showToast(getErrorMessage(err, 'Не удалось загрузить портфолио'));
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(category); }, [category]);
  useEffect(() => { setPage(1); }, [category, search]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setUploadError('Введите название'); return; }

    const fd = new FormData();
    fd.append('title', form.title.trim());
    fd.append('category', form.category);
    if (form.description.trim()) fd.append('description', form.description.trim());
    if (fileRef.current?.files[0]) fd.append('file', fileRef.current.files[0]);

    setUploading(true);
    setUploadError('');
    try {
      await uploadPortfolioItem(fd);
      setForm({ title: '', category: 'academic', description: '' });
      if (fileRef.current) fileRef.current.value = '';
      setShowForm(false);
      load(category);
    } catch (err) {
      showToast(getErrorMessage(err, 'Ошибка при загрузке файла'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Удалить запись из портфолио?')) return;
    setDeletingId(id);
    try {
      await deletePortfolioItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      showToast(getErrorMessage(err, 'Не удалось удалить запись'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleFileAction = async (item, inline) => {
    setFileLoadingId(item.id);
    try {
      const res = await fetchPortfolioFile(item.id, inline);
      openBlob(res.data, res.headers['content-type'], item.fileName, inline);
    } catch (err) {
      showToast(getErrorMessage(err, 'Не удалось открыть файл'));
    } finally {
      setFileLoadingId(null);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => i.title.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q))
    : items;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      <div className={styles.header}>
        <h1 className={s.pageTitle} style={{ margin: 0 }}>Портфолио</h1>
        <button className={styles.addBtn} onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Отмена' : '+ Добавить'}
        </button>
      </div>

      {showForm && (
        <form className={styles.form} onSubmit={handleUpload}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Название *</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Название работы"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className={styles.formRow}>
            <label className={styles.formLabel}>Категория *</label>
            <select
              className={styles.select}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.slice(1).map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.formRow}>
            <label className={styles.formLabel}>Описание</label>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              placeholder="Краткое описание (необязательно)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className={styles.formRow}>
            <label className={styles.formLabel}>Файл</label>
            <input className={styles.fileInput} type="file" ref={fileRef} />
            <span style={{ fontSize: 12, color: 'var(--text)', opacity: 0.55 }}>Максимальный размер: 25 МБ</span>
          </div>

          {uploadError && <p className={s.errorMsg}>{uploadError}</p>}

          <button className={styles.submitBtn} type="submit" disabled={uploading}>
            {uploading ? 'Загружаем...' : 'Сохранить'}
          </button>
        </form>
      )}

      <div className={styles.filterRow}>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            className={`${styles.filterBtn} ${category === c.value ? styles.filterActive : ''}`}
            onClick={() => setCategory(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <input
        className={styles.searchInput}
        type="text"
        placeholder="Поиск по названию или описанию..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <p className={s.empty}>Загрузка...</p>}

      {!loading && !loadError && filtered.length === 0 && (
        <div className={styles.emptyBox}>
          <p>{search.trim() ? `Ничего не найдено по запросу «${search.trim()}»` : 'Нет записей в портфолио'}</p>
          {!search.trim() && category && (
            <p style={{ marginTop: 4, fontSize: 13 }}>Попробуйте выбрать другую категорию</p>
          )}
        </div>
      )}

      {!loading && !loadError && filtered.length > 0 && (
        <>
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
          <div className={styles.list}>
            {paginated.map((item) => (
              <div key={item.id} className={styles.card}>
                <div className={styles.cardLeft}>
                  <span
                    className={styles.categoryTag}
                    style={{ background: `${CATEGORY_COLORS[item.category]}18`, color: CATEGORY_COLORS[item.category] }}
                  >
                    {CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
                  </span>
                  <span className={styles.cardTitle}>{item.title}</span>
                  {item.description && <span className={styles.cardDesc}>{item.description}</span>}
                  <div className={styles.cardMeta}>
                    <span>{formatDate(item.createdAt)}</span>
                    {item.fileName && item.fileSize && (
                      <span className={styles.fileInfo}>{formatSize(item.fileSize)}</span>
                    )}
                  </div>
                </div>

                <div className={styles.cardActions}>
                  {item.fileName && (
                    <button
                      className={styles.fileBtn}
                      onClick={() => handleFileAction(item, true)}
                      disabled={fileLoadingId === item.id}
                    >
                      {fileLoadingId === item.id ? '...' : 'Открыть'}
                    </button>
                  )}
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? '...' : '✕'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
