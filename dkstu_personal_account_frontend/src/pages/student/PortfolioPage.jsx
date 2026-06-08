import { useState, useEffect, useRef } from 'react';
import { getPortfolio, uploadPortfolioItem, deletePortfolioItem, downloadPortfolio, fetchPortfolioFile } from '../../api/students';
import { formatDateShort as formatDate } from '../../utils/date';
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

export default function PortfolioPage() {
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [fileLoadingId, setFileLoadingId] = useState(null);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({ title: '', category: 'academic', description: '' });
  const fileRef = useRef(null);

  const [showDownload, setShowDownload] = useState(false);
  const [dlForm, setDlForm] = useState({ category: '', dateFrom: '', dateTo: '' });
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState('');

  const load = (cat) => {
    setLoading(true);
    setError('');
    getPortfolio(cat || undefined)
      .then((res) => setItems(res.data))
      .catch(() => setError('Не удалось загрузить портфолио'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(category);
  }, [category]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setUploadError('Введите название');
      return;
    }

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
      setUploadError(err.response?.data?.message || 'Ошибка при загрузке');
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
    } catch {
      alert('Не удалось удалить');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (e) => {
    e.preventDefault();
    setDownloading(true);
    setDlError('');
    try {
      const params = {};
      if (dlForm.category) params.category = dlForm.category;
      if (dlForm.dateFrom) params.dateFrom = dlForm.dateFrom;
      if (dlForm.dateTo) params.dateTo = dlForm.dateTo;

      const res = await downloadPortfolio(params);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'portfolio.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowDownload(false);
    } catch (err) {
      if (err.response?.status === 404) {
        setDlError('Нет файлов по указанным фильтрам');
      } else {
        setDlError('Ошибка при скачивании архива');
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleFileAction = async (item, inline) => {
    setFileLoadingId(item.id);
    try {
      const res = await fetchPortfolioFile(item.id, inline);
      const contentType = res.headers['content-type'];
      openBlob(res.data, contentType, item.fileName, inline);
    } catch {
      alert('Не удалось загрузить файл');
    } finally {
      setFileLoadingId(null);
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={s.pageTitle} style={{ margin: 0 }}>Портфолио</h1>
        <div className={styles.headerBtns}>
          <button
            className={styles.downloadBtn}
            onClick={() => { setShowDownload((v) => !v); setDlError(''); }}
          >
            {showDownload ? 'Отмена' : '↓ Скачать архивом'}
          </button>
          <button className={styles.addBtn} onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Отмена' : '+ Добавить'}
          </button>
        </div>
      </div>

      {showDownload && (
        <form className={styles.form} onSubmit={handleDownload}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Категория</label>
            <select
              className={styles.select}
              value={dlForm.category}
              onChange={(e) => setDlForm({ ...dlForm, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.dateRow}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Дата с</label>
              <input
                type="date"
                className={styles.input}
                value={dlForm.dateFrom}
                onChange={(e) => setDlForm({ ...dlForm, dateFrom: e.target.value })}
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Дата по</label>
              <input
                type="date"
                className={styles.input}
                value={dlForm.dateTo}
                onChange={(e) => setDlForm({ ...dlForm, dateTo: e.target.value })}
              />
            </div>
          </div>
          {dlError && <p className={s.errorMsg}>{dlError}</p>}
          <button className={styles.submitBtn} type="submit" disabled={downloading}>
            {downloading ? 'Формируем архив...' : 'Скачать ZIP'}
          </button>
        </form>
      )}

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
      {error && <p className={s.errorMsg}>{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className={styles.emptyBox}>
          <p>Нет записей в портфолио</p>
          {category && (
            <p style={{ marginTop: 4, fontSize: 13 }}>
              Попробуйте выбрать другую категорию
            </p>
          )}
        </div>
      )}

      {!loading && items.length > 0 && (() => {
        const q = search.trim().toLowerCase();
        const visible = q
          ? items.filter(
              (i) =>
                i.title.toLowerCase().includes(q) ||
                (i.description || '').toLowerCase().includes(q),
            )
          : items;
        return (
          <>
            {visible.length === 0 && (
              <p className={s.empty}>Ничего не найдено по запросу «{search.trim()}»</p>
            )}
            <div className={styles.list}>
              {visible.map((item) => (
            <div key={item.id} className={styles.card}>
              <div className={styles.cardLeft}>
                <span
                  className={styles.categoryTag}
                  style={{ background: `${CATEGORY_COLORS[item.category]}18`, color: CATEGORY_COLORS[item.category] }}
                >
                  {CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
                </span>
                <span className={styles.cardTitle}>{item.title}</span>
                {item.description && (
                  <span className={styles.cardDesc}>{item.description}</span>
                )}
                <div className={styles.cardMeta}>
                  <span>{formatDate(item.createdAt)}</span>
                  {item.fileName && (
                    <span className={styles.fileInfo}>
                      {item.fileName} {item.fileSize ? `(${formatSize(item.fileSize)})` : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.cardActions}>
                {item.fileName && (
                  <button
                    className={styles.fileBtn}
                    onClick={() => handleFileAction(item, true)}
                    disabled={fileLoadingId === item.id}
                    title="Открыть в браузере"
                  >
                    Открыть
                  </button>
                )}
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  title="Удалить"
                >
                  {deletingId === item.id ? '...' : '✕'}
                </button>
              </div>
            </div>
              ))}
            </div>
          </>
        );
      })()}
    </div>
  );
}
