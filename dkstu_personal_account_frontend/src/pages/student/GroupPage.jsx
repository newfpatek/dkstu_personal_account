import { useState, useEffect } from 'react';
import { getMyGroup } from '../../api/students';
import s from './shared.module.css';
import styles from './GroupPage.module.css';

export default function GroupPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyGroup()
      .then((r) => setGroups(r.data))
      .catch(() => setError('Не удалось загрузить данные группы'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className={s.empty}>Загрузка...</p>;
  if (error) return <p className={s.errorMsg}>{error}</p>;

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
                    <td className={styles.numCell}>{idx + 1}</td>
                    <td>{member.fullName}</td>
                    <td>
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
