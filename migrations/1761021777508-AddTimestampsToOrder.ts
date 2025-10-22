import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTimestampsToOrder1761021777508 implements MigrationInterface {
    name = 'AddTimestampsToOrder1761021777508'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_tutorId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tasks_tutorId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_PRODUCTS_NAME"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_PRODUCTS_PRICE"`);
        await queryRunner.query(`ALTER TABLE "order" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "order" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_3dbb68d266903507781180d9ada" FOREIGN KEY ("tutorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_3dbb68d266903507781180d9ada"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "createdAt"`);
        await queryRunner.query(`CREATE INDEX "IDX_PRODUCTS_PRICE" ON "products" ("price") `);
        await queryRunner.query(`CREATE INDEX "IDX_PRODUCTS_NAME" ON "products" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_tasks_tutorId" ON "tasks" ("tutorId") `);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_tutorId" FOREIGN KEY ("tutorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
