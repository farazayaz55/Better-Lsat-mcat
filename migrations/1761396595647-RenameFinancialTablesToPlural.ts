import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameFinancialTablesToPlural1761396595647
    implements MigrationInterface
{
    name = 'RenameFinancialTablesToPlural1761396595647';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Simply rename tables from singular to plural
        await queryRunner.query(`ALTER TABLE "invoice" RENAME TO "invoices"`);
        await queryRunner.query(`ALTER TABLE "refund" RENAME TO "refunds"`);
        await queryRunner.query(
            `ALTER TABLE "payment_transaction" RENAME TO "payment_transactions"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert table names
        await queryRunner.query(
            `ALTER TABLE "payment_transactions" RENAME TO "payment_transaction"`,
        );
        await queryRunner.query(`ALTER TABLE "refunds" RENAME TO "refund"`);
        await queryRunner.query(`ALTER TABLE "invoices" RENAME TO "invoice"`);
    }
}
