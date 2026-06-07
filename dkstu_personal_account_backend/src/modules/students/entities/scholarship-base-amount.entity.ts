import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';
import { ScholarshipType } from '../enums/scholarship-type.enum';

@Entity('scholarship_base_amounts')
export class ScholarshipBaseAmount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ScholarshipType, unique: true })
  type!: ScholarshipType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
