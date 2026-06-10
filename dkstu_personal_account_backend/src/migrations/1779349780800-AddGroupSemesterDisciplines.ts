import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupSemesterDisciplines1779349780800 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS group_semester_disciplines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        discipline_id UUID NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
        semester INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT uq_group_sem_disc UNIQUE(group_id, discipline_id, semester)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS group_semester_disciplines`);
  }
}
