import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrder1759309587724 implements MigrationInterface {
    name = 'CreateOrder1759309587724';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "order" (
            "id" SERIAL NOT NULL,
            "customerId" integer NOT NULL,
            "items" json NOT NULL,
            "stripe_meta" json,
            "slot_reservation_expires_at" TIMESTAMP,
            "slot_reservation_status" character varying(20) DEFAULT 'RESERVED',
            CONSTRAINT "PK_1031171c13130102495201e3e20" PRIMARY KEY ("id")
        )`);
        await queryRunner.query(
            `ALTER TABLE "order" ADD CONSTRAINT "FK_124456e637ccffd3bce8ee5f65" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "order" DROP CONSTRAINT "FK_124456e637ccffd3bce8ee5f65"`,
        );
        await queryRunner.query(`DROP TABLE "order"`);
    }
}
