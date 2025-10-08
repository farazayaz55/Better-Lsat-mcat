import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1759739616918 implements MigrationInterface {
    name = 'Migrations1759739616918'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "workHours" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "workHours"`);
    }

}
