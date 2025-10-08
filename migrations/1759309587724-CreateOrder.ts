import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1759309587724 implements MigrationInterface {
    name = 'Migrations1759309587724';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Make username nullable
        await queryRunner.query(
            `ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL`,
        );

        // Make password nullable
        await queryRunner.query(
            `ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL`,
        );

        // Ensure roles defaults to empty array if needed
        await queryRunner.query(
            `ALTER TABLE "users" ALTER COLUMN "roles" SET DEFAULT '{}'`,
        );

        // Ensure isAccountDisabled has a default value
        await queryRunner.query(
            `ALTER TABLE "users" ALTER COLUMN "isAccountDisabled" SET DEFAULT false`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert username back to NOT NULL
        await queryRunner.query(
            `ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL`,
        );

        // Revert password back to NOT NULL
        await queryRunner.query(
            `ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL`,
        );

        // Remove default from roles
        await queryRunner.query(
            `ALTER TABLE "users" ALTER COLUMN "roles" DROP DEFAULT`,
        );

        // Remove default from isAccountDisabled
        await queryRunner.query(
            `ALTER TABLE "users" ALTER COLUMN "isAccountDisabled" DROP DEFAULT`,
        );
    }
}
