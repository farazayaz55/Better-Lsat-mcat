import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSlotReservationToOrders1759309587730
    implements MigrationInterface
{
    name = 'AddSlotReservationToOrders1759309587730';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add slot reservation fields to orders table
        await queryRunner.query(
            `ALTER TABLE "orders" ADD COLUMN "slot_reservation_expires_at" TIMESTAMP`,
        );

        await queryRunner.query(
            `ALTER TABLE "orders" ADD COLUMN "slot_reservation_status" VARCHAR(20) DEFAULT 'RESERVED'`,
        );

        // Create index for efficient querying of active reservations
        await queryRunner.query(
            `CREATE INDEX "idx_orders_reservation_expires" ON "orders"("slot_reservation_expires_at") WHERE "slot_reservation_status" = 'RESERVED'`,
        );

        // Update existing orders to have CONFIRMED status (they were already paid)
        await queryRunner.query(
            `UPDATE "orders" SET "slot_reservation_status" = 'CONFIRMED' WHERE "slot_reservation_status" = 'RESERVED'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the index
        await queryRunner.query(`DROP INDEX "idx_orders_reservation_expires"`);

        // Remove the columns
        await queryRunner.query(
            `ALTER TABLE "orders" DROP COLUMN "slot_reservation_status"`,
        );

        await queryRunner.query(
            `ALTER TABLE "orders" DROP COLUMN "slot_reservation_expires_at"`,
        );
    }
}
