import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Unique } from 'typeorm';
import { ScholarshipType } from '../enums/scholarship-type.enum';

@Entity('scholarship_base_amounts')
@Unique('scholarship_base_amounts_type_direction_unique', ['type', 'direction'])
export class ScholarshipBaseAmount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  type!: ScholarshipType;

  @Column({ type: 'varchar', nullable: true, default: null })
  direction!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
