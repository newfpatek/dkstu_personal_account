import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany,
} from 'typeorm';
import { DisciplineType } from '../enums/discipline-type.enum';
import { GradeRecord } from './grade-record.entity';

@Entity('disciplines')
export class Discipline {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({
    name: 'discipline_type',
    type: 'varchar',
    length: 10,
  })
  disciplineType!: DisciplineType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => GradeRecord, (gr) => gr.discipline)
  gradeRecords!: GradeRecord[];
}
