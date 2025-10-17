import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProducts1658910213536 implements MigrationInterface {
    name = 'CreateProducts1658910213536';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "products" (
            "id" SERIAL NOT NULL,
            "name" character varying(200) NOT NULL,
            "price" integer NOT NULL,
            "save" integer NOT NULL,
            "Duration" character varying(100) NOT NULL,
            "Description" text NOT NULL,
            "badge" json,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id")
        )`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "products"`);
    }
}
