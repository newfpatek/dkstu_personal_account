import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Group } from '../../groups/entities/group.entity';
import { Discipline } from '../../students/entities/discipline.entity';

@Entity('teacher_assignments')
@Unique(['teacherId', 'groupId', 'disciplineId', 'semester', 'academicYear'])
export class TeacherAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'teacher_id' })
  teacherId!: string;

  @Column({ name: 'group_id' })
  groupId!: string;

  @Column({ name: 'discipline_id' })
  disciplineId!: string;

  @Column()
  semester!: number;

  @Column({ name: 'academic_year', length: 9 })
  academicYear!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher!: User;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: Group;

  @ManyToOne(() => Discipline, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'discipline_id' })
  discipline!: Discipline;
}
