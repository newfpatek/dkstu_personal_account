import styles from './Toast.module.css';

const ICONS = {
  error: '✕',
  success: '✓',
  info: 'i',
};

export default function Toast({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className={styles.container}>
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
          <span className={styles.icon}>{ICONS[t.type] ?? 'i'}</span>
          <span className={styles.message}>{t.message}</span>
          <button className={styles.close} onClick={() => onDismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
