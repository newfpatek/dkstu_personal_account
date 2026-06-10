import {
  Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Discipline } from './discipline.entity';
import { GradeValue } from '../enums/grade-value.enum';

@Entity('grade_records')
export class GradeRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id' })
  studentId!: string;

  @Column({ name: 'discipline_id' })
  disciplineId!: string;

  @Column()
  semester!: number;

  @Column({ name: 'grade_value', type: 'enum', enum: GradeValue })
  gradeValue!: GradeValue;

  @Column({ name: 'is_debt', default: false })
  isDebt!: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.gradeRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: User;

  @ManyToOne(() => Discipline, (d) => d.gradeRecords)
  @JoinColumn({ name: 'discipline_id' })
  discipline!: Discipline;
}
