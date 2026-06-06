import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFullSchema1779349780200 implements MigrationInterface {
  name = 'CreateFullSchema1779349780200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Кастомные enum-типы ---
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE grade_value AS ENUM (
          'passed', 'failed', 'absent',
          'excellent', 'good', 'satisfactory', 'unsatisfactory', 'absent_exam'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE portfolio_category AS ENUM (
          'academic', 'research', 'social', 'sports', 'cultural'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE scholarship_type AS ENUM (
          'academic', 'social', 'enhanced_academic',
          'academic_coeff_1_4', 'academic_coeff_1_5', 'enhanced_social'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE enhanced_direction AS ENUM (
          'academic', 'research', 'social', 'sports', 'cultural'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // --- Таблица users ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
        "name"          VARCHAR(255) NOT NULL,
        "email"         VARCHAR(255) NOT NULL,
        "password_hash" VARCHAR(255) NOT NULL,
        "role"          VARCHAR(20)  NOT NULL,
        "is_paid"       BOOLEAN      NOT NULL DEFAULT false,
        "created_at"    TIMESTAMP    DEFAULT now(),
        CONSTRAINT "users_pkey"       PRIMARY KEY ("id"),
        CONSTRAINT "users_email_key"  UNIQUE ("email"),
        CONSTRAINT "users_role_check" CHECK (role = ANY (ARRAY['student','teacher','staff','admin']))
      )
    `);

    // --- Таблица groups ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "groups" (
        "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
        "name"       VARCHAR(100) NOT NULL,
        "year"       INTEGER      NOT NULL,
        "created_at" TIMESTAMP    DEFAULT now(),
        CONSTRAINT "groups_pkey"     PRIMARY KEY ("id"),
        CONSTRAINT "groups_name_key" UNIQUE ("name")
      )
    `);

    // --- Таблица user_groups ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_groups" (
        "user_id"  UUID NOT NULL,
        "group_id" UUID NOT NULL,
        CONSTRAINT "user_groups_pkey"         PRIMARY KEY ("user_id", "group_id"),
        CONSTRAINT "user_groups_user_id_fkey"  FOREIGN KEY ("user_id")  REFERENCES "users"("id")  ON DELETE CASCADE,
        CONSTRAINT "user_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE
      )
    `);

    // --- Таблица disciplines ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "disciplines" (
        "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
        "name"             VARCHAR(255) NOT NULL,
        "discipline_type"  VARCHAR(10)  NOT NULL,
        "created_at"       TIMESTAMP    DEFAULT now(),
        CONSTRAINT "disciplines_pkey"                  PRIMARY KEY ("id"),
        CONSTRAINT "disciplines_discipline_type_check" CHECK (discipline_type = ANY (ARRAY['exam','pass_fail']))
      )
    `);

    // --- Таблица grade_records ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grade_records" (
        "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
        "student_id"    UUID        NOT NULL,
        "discipline_id" UUID        NOT NULL,
        "semester"      INTEGER     NOT NULL,
        "academic_year" VARCHAR(9)  NOT NULL DEFAULT '2024-2025',
        "grade_value"   grade_value NOT NULL,
        "is_debt"       BOOLEAN     NOT NULL DEFAULT false,
        "updated_at"    TIMESTAMP   DEFAULT now(),
        CONSTRAINT "grade_records_pkey"           PRIMARY KEY ("id"),
        CONSTRAINT "grade_records_student_id_fkey"    FOREIGN KEY ("student_id")    REFERENCES "users"("id")       ON DELETE CASCADE,
        CONSTRAINT "grade_records_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_grades_student_year" ON "grade_records" ("student_id", "academic_year")
    `);

    // Триггерная функция: автоматически выставляет is_debt
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_is_debt()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.is_debt := NEW.grade_value IN ('failed', 'absent', 'unsatisfactory', 'absent_exam');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TRIGGER trg_update_is_debt
          BEFORE INSERT OR UPDATE ON grade_records
          FOR EACH ROW EXECUTE FUNCTION update_is_debt();
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // --- Таблица portfolio_items ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "portfolio_items" (
        "id"          UUID               NOT NULL DEFAULT gen_random_uuid(),
        "student_id"  UUID               NOT NULL,
        "title"       VARCHAR(255)       NOT NULL,
        "category"    portfolio_category NOT NULL,
        "file_path"   VARCHAR(500),
        "file_name"   VARCHAR(255),
        "file_size"   INTEGER,
        "description" TEXT,
        "created_at"  TIMESTAMP          DEFAULT now(),
        CONSTRAINT "portfolio_items_pkey"            PRIMARY KEY ("id"),
        CONSTRAINT "portfolio_items_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_portfolio_student"  ON "portfolio_items" ("student_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_portfolio_category" ON "portfolio_items" ("student_id", "category")`);

    // --- Таблица scholarships ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "scholarships" (
        "id"           UUID               NOT NULL DEFAULT gen_random_uuid(),
        "student_id"   UUID               NOT NULL,
        "type"         scholarship_type   NOT NULL,
        "direction"    enhanced_direction,
        "amount"       NUMERIC(10,2)      NOT NULL,
        "period_start" DATE               NOT NULL,
        "period_end"   DATE,
        "is_active"    BOOLEAN            NOT NULL DEFAULT true,
        "created_at"   TIMESTAMP          DEFAULT now(),
        CONSTRAINT "scholarships_pkey"            PRIMARY KEY ("id"),
        CONSTRAINT "scholarships_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "check_direction"              CHECK (direction IS NULL OR type = 'enhanced_academic')
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_scholarships_student" ON "scholarships" ("student_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_scholarships_active"  ON "scholarships" ("student_id", "is_active")`);

    // --- Таблица messages (новая) ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id"           UUID      NOT NULL DEFAULT gen_random_uuid(),
        "sender_id"    UUID      NOT NULL,
        "recipient_id" UUID,
        "group_id"     UUID,
        "text"         TEXT      NOT NULL,
        "created_at"   TIMESTAMP DEFAULT now(),
        CONSTRAINT "messages_pkey"             PRIMARY KEY ("id"),
        CONSTRAINT "messages_sender_id_fkey"    FOREIGN KEY ("sender_id")    REFERENCES "users"("id")  ON DELETE CASCADE,
        CONSTRAINT "messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id")  ON DELETE CASCADE,
        CONSTRAINT "messages_group_id_fkey"     FOREIGN KEY ("group_id")     REFERENCES "groups"("id") ON DELETE CASCADE,
        CONSTRAINT "messages_target_check"      CHECK (
          (recipient_id IS NOT NULL AND group_id IS NULL) OR
          (recipient_id IS NULL     AND group_id IS NOT NULL)
        )
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_messages_recipient" ON "messages" ("recipient_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_messages_group"     ON "messages" ("group_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scholarships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portfolio_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grade_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "disciplines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_groups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "groups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "enhanced_direction"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "scholarship_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "portfolio_category"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "grade_value"`);
  }
}
