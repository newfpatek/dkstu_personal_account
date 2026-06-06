import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToMany, JoinTable,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100, unique: true })
  name!: string;

  @Column()
  year!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToMany(() => User, (user) => user.groups)
  @JoinTable({
    name: 'user_groups',
    joinColumn:        { name: 'group_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id',  referencedColumnName: 'id' },
  })
  members!: User[];
}
