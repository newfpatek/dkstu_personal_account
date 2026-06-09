import { useState, useEffect } from 'react';
import { getMyGroup } from '../../api/students';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/error';
import s from './shared.module.css';
import styles from './GroupPage.module.css';

export default function GroupPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    getMyGroup()
      .then((r) => setGroups(r.data))
      .catch((err) => {
        showToast(getErrorMessage(err, 'Не удалось загрузить данные группы'));
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className={s.empty}>Загрузка...</p>;
  if (loadError) return <p className={s.errorMsg}>Не удалось загрузить данные. Попробуйте обновить страницу.</p>;

  if (groups.length === 0) {
    return (
      <div>
        <h1 className={s.pageTitle}>Моя группа</h1>
        <p className={s.empty}>Вы не состоите ни в одной группе</p>
      </div>
    );
  }

  return (
    <div>
      {groups.map((group) => (
        <div key={group.id}>
          <div className={styles.groupHeader}>
            <div>
              <h1 className={s.pageTitle} style={{ margin: 0 }}>{group.name}</h1>
              <span className={styles.groupMeta}>{group.year} год набора · {group.members.length} чел.</span>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>№</th>
                  <th>ФИО</th>
                  <th style={{ width: 160 }}>Роль в группе</th>
                </tr>
              </thead>
              <tbody>
                {group.members.map((member, idx) => (
                  <tr key={member.id}>
                    <td data-label="№" className={styles.numCell}>{idx + 1}</td>
                    <td data-label="ФИО">{member.fullName}</td>
                    <td data-label="Роль в группе">
                      {member.groupRole && (
                        <span className={styles.roleTag}>{member.groupRole}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
