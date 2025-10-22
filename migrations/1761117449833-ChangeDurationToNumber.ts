import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeDurationToNumber1761117449833 implements MigrationInterface {
    name = 'ChangeDurationToNumber1761117449833';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, update existing data to convert string durations to numbers
        await queryRunner.query(`
            UPDATE products 
            SET "Duration" = CASE 
                WHEN "Duration" = 'Unlimited' THEN '60'
                WHEN "Duration" LIKE '%15%' THEN '15'
                WHEN "Duration" LIKE '%60%' THEN '60'
                ELSE '60'
            END
        `);

        // Then change the column type
        await queryRunner.query(
            `ALTER TABLE "products" ALTER COLUMN "Duration" TYPE INTEGER USING "Duration"::INTEGER`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "products" DROP COLUMN "Duration"`,
        );
        await queryRunner.query(
            `ALTER TABLE "products" ADD "Duration" character varying(100) NOT NULL`,
        );
    }
}
