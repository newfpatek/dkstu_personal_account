import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectionToBaseAmounts1779349780900 implements MigrationInterface {
  name = 'AddDirectionToBaseAmounts1779349780900';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        -- Add direction column
        ALTER TABLE scholarship_base_amounts ADD COLUMN IF NOT EXISTS direction varchar(50) DEFAULT NULL;

        -- Drop old unique constraint on type only
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'scholarship_base_amounts_type_key'
            AND conrelid = 'scholarship_base_amounts'::regclass
        ) THEN
          ALTER TABLE scholarship_base_amounts DROP CONSTRAINT scholarship_base_amounts_type_key;
        END IF;

        -- Add composite unique constraint on (type, direction)
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'scholarship_base_amounts_type_direction_unique'
            AND conrelid = 'scholarship_base_amounts'::regclass
        ) THEN
          ALTER TABLE scholarship_base_amounts
            ADD CONSTRAINT scholarship_base_amounts_type_direction_unique UNIQUE(type, direction);
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE scholarship_base_amounts DROP CONSTRAINT IF EXISTS scholarship_base_amounts_type_direction_unique;
        ALTER TABLE scholarship_base_amounts DROP COLUMN IF EXISTS direction;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'scholarship_base_amounts_type_key'
            AND conrelid = 'scholarship_base_amounts'::regclass
        ) THEN
          ALTER TABLE scholarship_base_amounts ADD CONSTRAINT scholarship_base_amounts_type_key UNIQUE(type);
        END IF;
      END $$;
    `);
  }
}
