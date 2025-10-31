import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddNotesToOrder1762200000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'order',
            new TableColumn({
                name: 'notes',
                type: 'text',
                isNullable: true,
            }),
        );

        console.log('Added notes column to order table');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('order', 'notes');

        console.log('Removed notes column from order table');
    }
}
