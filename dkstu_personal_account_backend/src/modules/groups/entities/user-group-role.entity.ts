import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('user_group_roles')
export class UserGroupRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'group_id' })
  groupId!: string;

  @Column({ length: 100 })
  label!: string;
}
