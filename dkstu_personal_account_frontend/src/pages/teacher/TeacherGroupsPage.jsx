import { useState, useEffect } from 'react';
import { getTeacherGroups, getTeacherGroupStudents } from '../../api/teacher';
import s from '../student/shared.module.css';
import styles from './TeacherGroupsPage.module.css';

function StudentRow({ student, idx }) {
  const hasDebts = student.debtCount > 0;
  return (
    <tr>
      <td className={styles.numCell}>{idx + 1}</td>
      <td>
        <span>{student.fullName}</span>
        {student.groupRole && (
          <span className={styles.roleTag}>{student.groupRole}</span>
        )}
      </td>
      <td>
        {student.isPaid ? (
          <span className={styles.paidBadge}>Контракт</span>
        ) : null}
      </td>
      <td className={styles.statCell}>{student.totalGrades}</td>
      <td className={styles.statCell}>
        {hasDebts ? (
          <span className={`${s.badge} ${s.debtBadge}`}>{student.debtCount}</span>
        ) : (
          <span className={styles.noDebts}>—</span>
        )}
      </td>
    </tr>
  );
}

function GroupCard({ group, onSelect, selected }) {
  return (
    <button
      className={`${styles.groupCard} ${selected ? styles.groupCardSelected : ''}`}
      onClick={() => onSelect(group.id)}
    >
      <span className={styles.groupName}>{group.name}</span>
      <span className={styles.groupMeta}>{group.year} г.н. · {group.studentCount} чел.</span>
    </button>
  );
}

export default function TeacherGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getTeacherGroups()
      .then((r) => {
        setGroups(r.data);
        if (r.data.length > 0) setSelectedGroupId(r.data[0].id);
      })
      .catch(() => setError('Не удалось загрузить группы'))
      .finally(() => setLoadingGroups(false));
  }, []);

  useEffect(() => {
    if (!selectedGroupId) return;
    setLoadingDetail(true);
    setDetail(null);
    getTeacherGroupStudents(selectedGroupId)
      .then((r) => setDetail(r.data))
      .catch(() => setError('Не удалось загрузить состав группы'))
      .finally(() => setLoadingDetail(false));
  }, [selectedGroupId]);

  if (loadingGroups) return <p className={s.empty}>Загрузка...</p>;
  if (error) return <p className={s.errorMsg}>{error}</p>;

  if (groups.length === 0) {
    return (
      <div>
        <h1 className={s.pageTitle}>Мои группы</h1>
        <p className={s.empty}>Вы не привязаны ни к одной группе. Обратитесь к администратору.</p>
      </div>
    );
  }

  const debtTotal = detail?.students.reduce((sum, st) => sum + st.debtCount, 0) ?? 0;
  const studentCount = detail?.students.length ?? 0;

  return (
    <div>
      <h1 className={s.pageTitle}>Мои группы</h1>

      <div className={styles.groupTabs}>
        {groups.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            selected={g.id === selectedGroupId}
            onSelect={setSelectedGroupId}
          />
        ))}
      </div>

      {loadingDetail && <p className={s.empty}>Загрузка состава группы...</p>}

      {!loadingDetail && detail && (
        <>
          <div className={s.summaryRow}>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>Студентов</span>
              <span className={s.summaryValue}>{studentCount}</span>
            </div>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>Задолженностей</span>
              <span className={`${s.summaryValue} ${debtTotal > 0 ? styles.debtValue : ''}`}>
                {debtTotal}
              </span>
            </div>
          </div>

          {studentCount === 0 ? (
            <p className={s.empty}>В группе нет студентов</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>№</th>
                    <th>ФИО</th>
                    <th style={{ width: 110 }}>Тип обучения</th>
                    <th style={{ width: 90 }}>Оценок</th>
                    <th style={{ width: 90 }}>Долгов</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.students.map((student, idx) => (
                    <StudentRow key={student.id} student={student} idx={idx} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
