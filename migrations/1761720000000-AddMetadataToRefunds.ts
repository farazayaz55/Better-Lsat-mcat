import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMetadataToRefunds1761720000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'refunds',
            new TableColumn({
                name: 'metadata',
                type: 'jsonb',
                isNullable: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('refunds', 'metadata');
    }
}
