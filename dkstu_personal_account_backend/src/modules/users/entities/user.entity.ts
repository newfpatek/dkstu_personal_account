// src/modules/users/entities/user.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn
} from 'typeorm';

@Entity('users') // имя таблицы в PostgreSQL
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string; // хранить будем хэш, не сам пароль!

  @Column()
  fullName!: string;

  @Column({ default: 'student' })
  role!: string; // 'student' | 'admin'

  @CreateDateColumn()
  createdAt!: Date;
}