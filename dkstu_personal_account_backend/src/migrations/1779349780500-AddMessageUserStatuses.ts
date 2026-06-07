import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageUserStatuses1779349780500 implements MigrationInterface {
  name = 'AddMessageUserStatuses1779349780500';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS message_user_statuses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        is_relevant boolean NOT NULL DEFAULT true,
        UNIQUE(user_id, message_id)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS message_user_statuses`);
  }
}
