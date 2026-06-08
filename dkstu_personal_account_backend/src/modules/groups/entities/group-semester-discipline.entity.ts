import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Group } from './group.entity';
import { Discipline } from '../../students/entities/discipline.entity';

@Entity('group_semester_disciplines')
export class GroupSemesterDiscipline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id' })
  groupId: string;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ name: 'discipline_id' })
  disciplineId: string;

  @ManyToOne(() => Discipline, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'discipline_id' })
  discipline: Discipline;

  @Column({ type: 'integer' })
  semester: number;

  @Column({ name: 'academic_year', length: 9 })
  academicYear: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
