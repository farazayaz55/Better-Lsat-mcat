import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStripeMetaToOrder1759309587725 implements MigrationInterface {
    name = 'AddStripeMetaToOrder1759309587725';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" ADD "stripe_meta" json`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "order" DROP COLUMN "stripe_meta"`,
        );
    }
}
