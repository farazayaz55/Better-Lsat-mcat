import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOrderStatusToOrder1762400000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum type if not exists (Postgres)
        await queryRunner.query(
            "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status_enum') THEN CREATE TYPE order_status_enum AS ENUM ('PENDING','IN_PROGRESS','COMPLETED'); END IF; END $$;",
        );

        // Add orderStatus column
        // If legacy camelCase column exists, rename to snake_case for consistency
        await queryRunner.query(
            'DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = \'order\' AND column_name = \'orderstatus\') THEN ALTER TABLE "order" RENAME COLUMN "orderStatus" TO "order_status"; END IF; END $$;',
        );

        await queryRunner.addColumn(
            'order',
            new TableColumn({
                name: 'order_status',
                type: 'order_status_enum',
                isNullable: false,
                default: `'PENDING'`,
            }),
        );

        // Add completedAt column
        // Rename legacy completedAt to completed_at if it exists
        await queryRunner.query(
            'DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = \'order\' AND column_name = \'completedat\') THEN ALTER TABLE "order" RENAME COLUMN "completedAt" TO "completed_at"; END IF; END $$;',
        );

        await queryRunner.addColumn(
            'order',
            new TableColumn({
                name: 'completed_at',
                type: 'timestamptz',
                isNullable: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "order" DROP COLUMN IF EXISTS "completed_at"',
        );
        await queryRunner.query(
            'ALTER TABLE "order" DROP COLUMN IF EXISTS "order_status"',
        );
        await queryRunner.query(
            "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status_enum') THEN DROP TYPE order_status_enum; END IF; END $$;",
        );
    }
}
