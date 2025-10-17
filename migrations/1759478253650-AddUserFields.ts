import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserFields1759478253650 implements MigrationInterface {
    name = 'AddUserFields1759478253650';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "users" ADD "phone" character varying(20)`,
        );
        await queryRunner.query(`ALTER TABLE "users" ADD "workHours" json`);
        await queryRunner.query(`ALTER TABLE "users" ADD "serviceIds" text`);
        await queryRunner.query(
            `ALTER TABLE "users" ADD "lastAssignedOrderCount" integer NOT NULL DEFAULT '0'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "users" DROP COLUMN "lastAssignedOrderCount"`,
        );
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "serviceIds"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "workHours"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
    }
}
