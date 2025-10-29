import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditFieldsToFinancialEntities1759309588002
    implements MigrationInterface
{
    name = 'AddAuditFieldsToFinancialEntities1759309588002';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add audit fields to invoices table
        await queryRunner.query(`
      ALTER TABLE "invoices" 
      ADD COLUMN "initiatedBy" integer NULL,
      ADD COLUMN "processedBy" integer NULL
    `);

        // Add audit fields to refunds table
        await queryRunner.query(`
      ALTER TABLE "refunds" 
      ADD COLUMN "initiatedBy" integer NULL,
      ADD COLUMN "processedBy" integer NULL
    `);

        // Add audit fields to payment_transactions table
        await queryRunner.query(`
      ALTER TABLE "payment_transactions" 
      ADD COLUMN "initiatedBy" integer NULL,
      ADD COLUMN "processedBy" integer NULL
    `);

        // Add foreign key constraints for audit fields
        await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD CONSTRAINT "FK_invoices_initiatedBy" FOREIGN KEY ("initiatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

        await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD CONSTRAINT "FK_invoices_processedBy" FOREIGN KEY ("processedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

        await queryRunner.query(`
      ALTER TABLE "refunds"
      ADD CONSTRAINT "FK_refunds_initiatedBy" FOREIGN KEY ("initiatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

        await queryRunner.query(`
      ALTER TABLE "refunds"
      ADD CONSTRAINT "FK_refunds_processedBy" FOREIGN KEY ("processedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

        await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "FK_payment_transactions_initiatedBy" FOREIGN KEY ("initiatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

        await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "FK_payment_transactions_processedBy" FOREIGN KEY ("processedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

        // Add indexes for audit fields
        await queryRunner.query(`
      CREATE INDEX "IDX_invoices_initiatedBy" ON "invoices" ("initiatedBy")
    `);

        await queryRunner.query(`
      CREATE INDEX "IDX_invoices_processedBy" ON "invoices" ("processedBy")
    `);

        await queryRunner.query(`
      CREATE INDEX "IDX_refunds_initiatedBy" ON "refunds" ("initiatedBy")
    `);

        await queryRunner.query(`
      CREATE INDEX "IDX_refunds_processedBy" ON "refunds" ("processedBy")
    `);

        await queryRunner.query(`
      CREATE INDEX "IDX_payment_transactions_initiatedBy" ON "payment_transactions" ("initiatedBy")
    `);

        await queryRunner.query(`
      CREATE INDEX "IDX_payment_transactions_processedBy" ON "payment_transactions" ("processedBy")
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(
            `DROP INDEX "IDX_payment_transactions_processedBy"`,
        );
        await queryRunner.query(
            `DROP INDEX "IDX_payment_transactions_initiatedBy"`,
        );
        await queryRunner.query(`DROP INDEX "IDX_refunds_processedBy"`);
        await queryRunner.query(`DROP INDEX "IDX_refunds_initiatedBy"`);
        await queryRunner.query(`DROP INDEX "IDX_invoices_processedBy"`);
        await queryRunner.query(`DROP INDEX "IDX_invoices_initiatedBy"`);

        // Drop foreign key constraints
        await queryRunner.query(
            `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_payment_transactions_processedBy"`,
        );
        await queryRunner.query(
            `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_payment_transactions_initiatedBy"`,
        );
        await queryRunner.query(
            `ALTER TABLE "refunds" DROP CONSTRAINT "FK_refunds_processedBy"`,
        );
        await queryRunner.query(
            `ALTER TABLE "refunds" DROP CONSTRAINT "FK_refunds_initiatedBy"`,
        );
        await queryRunner.query(
            `ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_processedBy"`,
        );
        await queryRunner.query(
            `ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_initiatedBy"`,
        );

        // Drop columns
        await queryRunner.query(`
      ALTER TABLE "payment_transactions" 
      DROP COLUMN "processedBy",
      DROP COLUMN "initiatedBy"
    `);

        await queryRunner.query(`
      ALTER TABLE "refunds" 
      DROP COLUMN "processedBy",
      DROP COLUMN "initiatedBy"
    `);

        await queryRunner.query(`
      ALTER TABLE "invoices" 
      DROP COLUMN "processedBy",
      DROP COLUMN "initiatedBy"
    `);
    }
}
