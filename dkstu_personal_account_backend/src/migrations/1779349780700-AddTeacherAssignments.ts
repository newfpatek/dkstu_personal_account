import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeacherAssignments1779349780700 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS teacher_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        discipline_id UUID NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
        semester INT NOT NULL,
        academic_year VARCHAR(9) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(teacher_id, group_id, discipline_id, semester, academic_year)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS teacher_assignments;`);
  }
}
