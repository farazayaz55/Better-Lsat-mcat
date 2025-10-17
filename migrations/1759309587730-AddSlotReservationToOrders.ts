import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSlotReservationToOrders1759309587730
    implements MigrationInterface
{
    name = 'AddSlotReservationToOrders1759309587730';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "order" ADD "slot_reservation_expires_at" TIMESTAMP`,
        );
        await queryRunner.query(
            `ALTER TABLE "order" ADD "slot_reservation_status" character varying(20) DEFAULT 'RESERVED'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "order" DROP COLUMN "slot_reservation_status"`,
        );
        await queryRunner.query(
            `ALTER TABLE "order" DROP COLUMN "slot_reservation_expires_at"`,
        );
    }
}
