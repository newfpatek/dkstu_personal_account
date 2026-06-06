import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToMany,
} from 'typeorm';
import { Role } from '../../../auth/enums/role.enum';
import { GradeRecord } from '../../students/entities/grade-record.entity';
import { PortfolioItem } from '../../students/entities/portfolio-item.entity';
import { Scholarship } from '../../students/entities/scholarship.entity';
import { Group } from '../../groups/entities/group.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'name', length: 255 })
  fullName!: string;

  @Column({ length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', length: 255 })
  password!: string;

  @Column({ type: 'varchar', length: 20, default: Role.STUDENT })
  role!: Role;

  @Column({ name: 'is_paid', default: false })
  isPaid!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => GradeRecord, (gr) => gr.student)
  gradeRecords!: GradeRecord[];

  @OneToMany(() => PortfolioItem, (pi) => pi.student)
  portfolioItems!: PortfolioItem[];

  @OneToMany(() => Scholarship, (s) => s.student)
  scholarships!: Scholarship[];

  @ManyToMany(() => Group, (group) => group.members)
  groups!: Group[];
}
