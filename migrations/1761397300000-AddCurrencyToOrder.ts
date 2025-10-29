import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCurrencyToOrder1761397300000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add currency column to order table
        await queryRunner.addColumn(
            'order',
            new TableColumn({
                name: 'currency',
                type: 'varchar',
                length: '3',
                default: "'CAD'",
                isNullable: false,
            }),
        );

        console.log('Added currency column to order table');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove currency column from order table
        await queryRunner.dropColumn('order', 'currency');

        console.log('Removed currency column from order table');
    }
}
