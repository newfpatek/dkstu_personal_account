import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserGroupRoles1779349780400 implements MigrationInterface {
  name = 'AddUserGroupRoles1779349780400';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_group_roles (
        id        uuid DEFAULT gen_random_uuid() NOT NULL,
        user_id   uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
        group_id  uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        label     varchar(100) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE (user_id, group_id)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_group_roles`);
  }
}
