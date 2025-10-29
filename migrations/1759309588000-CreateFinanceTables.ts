import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFinanceTables1759309588000 implements MigrationInterface {
    name = 'CreateFinanceTables1759309588000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create invoices table
        await queryRunner.query(`
            CREATE TABLE "invoices" (
                "id" SERIAL NOT NULL,
                "invoiceNumber" character varying(50) NOT NULL,
                "orderId" integer NOT NULL,
                "customerId" integer NOT NULL,
                "status" character varying NOT NULL DEFAULT 'draft',
                "issueDate" date NOT NULL,
                "dueDate" date NOT NULL,
                "items" jsonb NOT NULL,
                "subtotal" bigint NOT NULL,
                "tax" bigint NOT NULL DEFAULT '0',
                "discount" bigint NOT NULL DEFAULT '0',
                "total" bigint NOT NULL,
                "currency" character varying(3) NOT NULL DEFAULT 'USD',
                "notes" text,
                "voidedAt" TIMESTAMP,
                "voidReason" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_invoices" PRIMARY KEY ("id")
            )
        `);

        // Create refunds table
        await queryRunner.query(`
            CREATE TABLE "refunds" (
                "id" SERIAL NOT NULL,
                "refundNumber" character varying(50) NOT NULL,
                "originalOrderId" integer NOT NULL,
                "newOrderId" integer,
                "invoiceId" integer,
                "customerId" integer NOT NULL,
                "amount" bigint NOT NULL,
                "currency" character varying(3) NOT NULL DEFAULT 'USD',
                "reason" character varying NOT NULL,
                "reasonDetails" text NOT NULL,
                "stripeRefundId" character varying(100),
                "status" character varying NOT NULL DEFAULT 'pending',
                "refundedAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_refunds" PRIMARY KEY ("id")
            )
        `);

        // Create payment_transactions table
        await queryRunner.query(`
            CREATE TABLE "payment_transactions" (
                "id" SERIAL NOT NULL,
                "transactionNumber" character varying(50) NOT NULL,
                "orderId" integer NOT NULL,
                "invoiceId" integer,
                "customerId" integer NOT NULL,
                "type" character varying NOT NULL,
                "amount" bigint NOT NULL,
                "currency" character varying(3) NOT NULL DEFAULT 'USD',
                "paymentMethod" character varying(50) NOT NULL,
                "stripePaymentIntentId" character varying(100),
                "stripeChargeId" character varying(100),
                "status" character varying(50) NOT NULL,
                "metadata" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_payment_transactions" PRIMARY KEY ("id")
            )
        `);

        // Create unique indexes
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_invoices_invoiceNumber" ON "invoices" ("invoiceNumber")`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_refunds_refundNumber" ON "refunds" ("refundNumber")`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_payment_transactions_transactionNumber" ON "payment_transactions" ("transactionNumber")`,
        );

        // Create regular indexes
        await queryRunner.query(
            `CREATE INDEX "IDX_invoices_orderId" ON "invoices" ("orderId")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_invoices_customerId" ON "invoices" ("customerId")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_invoices_status" ON "invoices" ("status")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_invoices_issueDate" ON "invoices" ("issueDate")`,
        );

        await queryRunner.query(
            `CREATE INDEX "IDX_refunds_originalOrderId" ON "refunds" ("originalOrderId")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_refunds_customerId" ON "refunds" ("customerId")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_refunds_status" ON "refunds" ("status")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_refunds_createdAt" ON "refunds" ("createdAt")`,
        );

        await queryRunner.query(
            `CREATE INDEX "IDX_payment_transactions_orderId" ON "payment_transactions" ("orderId")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_payment_transactions_customerId" ON "payment_transactions" ("customerId")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_payment_transactions_type" ON "payment_transactions" ("type")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_payment_transactions_status" ON "payment_transactions" ("status")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_payment_transactions_createdAt" ON "payment_transactions" ("createdAt")`,
        );

        // Add foreign key constraints
        await queryRunner.query(
            `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_orderId" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_customerId" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );

        await queryRunner.query(
            `ALTER TABLE "refunds" ADD CONSTRAINT "FK_refunds_originalOrderId" FOREIGN KEY ("originalOrderId") REFERENCES "order"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "refunds" ADD CONSTRAINT "FK_refunds_newOrderId" FOREIGN KEY ("newOrderId") REFERENCES "order"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "refunds" ADD CONSTRAINT "FK_refunds_invoiceId" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "refunds" ADD CONSTRAINT "FK_refunds_customerId" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );

        await queryRunner.query(
            `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_payment_transactions_orderId" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_payment_transactions_invoiceId" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_payment_transactions_customerId" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints
        await queryRunner.query(
            `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_payment_transactions_customerId"`,
        );
        await queryRunner.query(
            `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_payment_transactions_invoiceId"`,
        );
        await queryRunner.query(
            `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_payment_transactions_orderId"`,
        );

        await queryRunner.query(
            `ALTER TABLE "refunds" DROP CONSTRAINT "FK_refunds_customerId"`,
        );
        await queryRunner.query(
            `ALTER TABLE "refunds" DROP CONSTRAINT "FK_refunds_invoiceId"`,
        );
        await queryRunner.query(
            `ALTER TABLE "refunds" DROP CONSTRAINT "FK_refunds_newOrderId"`,
        );
        await queryRunner.query(
            `ALTER TABLE "refunds" DROP CONSTRAINT "FK_refunds_originalOrderId"`,
        );

        await queryRunner.query(
            `ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_customerId"`,
        );
        await queryRunner.query(
            `ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_orderId"`,
        );

        // Drop indexes
        await queryRunner.query(
            `DROP INDEX "IDX_payment_transactions_createdAt"`,
        );
        await queryRunner.query(`DROP INDEX "IDX_payment_transactions_status"`);
        await queryRunner.query(`DROP INDEX "IDX_payment_transactions_type"`);
        await queryRunner.query(
            `DROP INDEX "IDX_payment_transactions_customerId"`,
        );
        await queryRunner.query(
            `DROP INDEX "IDX_payment_transactions_orderId"`,
        );

        await queryRunner.query(`DROP INDEX "IDX_refunds_createdAt"`);
        await queryRunner.query(`DROP INDEX "IDX_refunds_status"`);
        await queryRunner.query(`DROP INDEX "IDX_refunds_customerId"`);
        await queryRunner.query(`DROP INDEX "IDX_refunds_originalOrderId"`);

        await queryRunner.query(`DROP INDEX "IDX_invoices_issueDate"`);
        await queryRunner.query(`DROP INDEX "IDX_invoices_status"`);
        await queryRunner.query(`DROP INDEX "IDX_invoices_customerId"`);
        await queryRunner.query(`DROP INDEX "IDX_invoices_orderId"`);

        await queryRunner.query(
            `DROP INDEX "IDX_payment_transactions_transactionNumber"`,
        );
        await queryRunner.query(`DROP INDEX "IDX_refunds_refundNumber"`);
        await queryRunner.query(`DROP INDEX "IDX_invoices_invoiceNumber"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE "payment_transactions"`);
        await queryRunner.query(`DROP TABLE "refunds"`);
        await queryRunner.query(`DROP TABLE "invoices"`);
    }
}
