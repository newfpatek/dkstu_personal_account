import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ScholarshipType } from '../enums/scholarship-type.enum';
import { EnhancedDirection } from '../enums/enhanced-direction.enum';

@Entity('scholarships')
export class Scholarship {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id' })
  studentId!: string;

  @Column({ type: 'enum', enum: ScholarshipType })
  type!: ScholarshipType;

  @Column({ type: 'enum', enum: EnhancedDirection, nullable: true })
  direction!: EnhancedDirection | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ name: 'period_start', type: 'date' })
  periodStart!: string;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd!: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'auto_assigned', default: false })
  autoAssigned!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.scholarships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: User;
}
