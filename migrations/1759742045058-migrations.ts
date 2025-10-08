import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1759742045058 implements MigrationInterface {
    name = 'Migrations1759742045058'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "workHours"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "workHours" json`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "workHours"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "workHours" text`);
    }

}
