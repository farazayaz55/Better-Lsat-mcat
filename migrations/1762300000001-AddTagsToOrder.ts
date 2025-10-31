import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTagsToOrder1762300000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum type if it does not exist (compat with older Postgres versions)
        await queryRunner.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'order_tag_enum'
  ) THEN
    CREATE TYPE order_tag_enum AS ENUM ('SHOWED', 'NO_SHOW');
  END IF;
END
$$;`);

        // Add tags[] column if missing
        await queryRunner.query(
            `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "tags" order_tag_enum[]`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "order" DROP COLUMN IF EXISTS "tags"`,
        );
        await queryRunner.query(
            `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_tag_enum') THEN DROP TYPE order_tag_enum; END IF; END $$;`,
        );
    }
}
