import { useState, useEffect, useRef } from 'react';
import { getGroups, getGroupById } from '../../api/teacher';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/error';
import s from '../student/shared.module.css';
import styles from './TeacherGroupsPage.module.css';

const ROLE_LABELS = {
  student: 'Студент',
  teacher: 'Преподаватель',
  staff: 'Сотрудник',
  admin: 'Администратор',
};

function GroupItem({ group, selected, onSelect }) {
  return (
    <div
      className={`${styles.groupItem} ${selected ? styles.groupItemSelected : ''}`}
      onClick={() => onSelect(group.id)}
    >
      <span className={styles.groupName}>{group.name}</span>
      <span className={styles.groupMeta}>{group.year} г.н. · {group.studentCount} студ.</span>
    </div>
  );
}

export default function TeacherGroupsPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    getGroups()
      .then((r) => setGroups(r.data))
      .catch((err) => showToast(getErrorMessage(err, 'Не удалось загрузить группы')))
      .finally(() => setLoadingGroups(false));
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(search), 1000);
    return () => clearTimeout(searchDebounceRef.current);
  }, [search]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingDetail(true);
    setDetail(null);
    getGroupById(selectedId)
      .then((r) => setDetail(r.data))
      .catch((err) => showToast(getErrorMessage(err, 'Не удалось загрузить состав группы')))
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  const q = debouncedSearch.trim().toLowerCase();
  const filteredGroups = q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : [];

  const students = detail?.members.filter((m) => m.role === 'student') ?? [];
  const others = detail?.members.filter((m) => m.role !== 'student') ?? [];

  return (
    <div>
      <h1 className={s.pageTitle}>Группы</h1>

      <div className={styles.splitLayout}>
        {/* Left panel */}
        <div className={styles.leftPanel}>
          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Поиск по названию..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.groupList}>
            {loadingGroups && <p className={styles.emptyList}>Загрузка...</p>}
            {!loadingGroups && !q && (
              <p className={styles.emptyList}>Введите название группы для поиска</p>
            )}
            {!loadingGroups && q && filteredGroups.length === 0 && (
              <p className={styles.emptyList}>Групп не найдено</p>
            )}
            {!loadingGroups && filteredGroups.map((g) => (
              <GroupItem
                key={g.id}
                group={g}
                selected={g.id === selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className={styles.rightPanel}>
          {!selectedId && (
            <div className={styles.placeholder}>Выберите группу из списка</div>
          )}
          {selectedId && loadingDetail && <p className={s.empty}>Загрузка...</p>}
          {selectedId && !loadingDetail && detail && (
            <div>
              <h2 className={styles.groupTitle}>
                {detail.name}
                <span className={styles.groupYear}> {detail.year} г.н.</span>
              </h2>

              <div className={s.summaryRow} style={{ marginBottom: 20 }}>
                <div className={s.summaryCard}>
                  <span className={s.summaryLabel}>Студентов</span>
                  <span className={s.summaryValue}>{students.length}</span>
                </div>
              </div>

              {students.length === 0 ? (
                <p className={s.empty}>В группе нет студентов</p>
              ) : (
                <table className={s.table} style={{ marginBottom: 24 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>№</th>
                      <th>ФИО</th>
                      <th style={{ width: 150 }}>Роль в группе</th>
                      <th style={{ width: 110 }}>Обучение</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((member, idx) => (
                      <tr key={member.id}>
                        <td data-label="№">{idx + 1}</td>
                        <td data-label="ФИО">{member.fullName}</td>
                        <td data-label="Роль в группе">
                          {member.groupRole && (
                            <span className={styles.roleTag}>{member.groupRole}</span>
                          )}
                        </td>
                        <td data-label="Обучение">
                          {member.isPaid && (
                            <span className={styles.paidBadge}>Контракт</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {others.length > 0 && (
                <>
                  <h3 className={styles.sectionTitle}>Прочие участники</h3>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>ФИО</th>
                        <th style={{ width: 130 }}>Роль</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {others.map((member) => (
                        <tr key={member.id}>
                          <td data-label="ФИО">{member.fullName}</td>
                          <td data-label="Роль">{ROLE_LABELS[member.role] || member.role}</td>
                          <td data-label="Email">{member.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
