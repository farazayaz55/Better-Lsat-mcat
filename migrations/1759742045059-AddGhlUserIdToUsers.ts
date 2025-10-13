import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGhlUserIdToUsers1759742045059 implements MigrationInterface {
    name = 'AddGhlUserIdToUsers1759742045059';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "users" ADD "ghlUserId" character varying`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "ghlUserId"`);
    }
}
