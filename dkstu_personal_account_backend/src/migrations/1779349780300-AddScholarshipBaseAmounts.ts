import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScholarshipBaseAmounts1779349780300 implements MigrationInterface {
  name = 'AddScholarshipBaseAmounts1779349780300';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS scholarship_base_amounts (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        type        varchar CHECK (type IN (
                      'academic','social','enhanced_academic',
                      'academic_coeff_1_4','academic_coeff_1_5','enhanced_social'
                    )) NOT NULL UNIQUE,
        amount      numeric(10,2) NOT NULL,
        updated_at  timestamptz DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS scholarship_base_amounts`);
  }
}
