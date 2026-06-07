import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('message_user_statuses')
export class MessageUserStatus {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'message_id' })
  messageId!: string;

  @Column({ name: 'is_relevant', default: true })
  isRelevant!: boolean;
}
