import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateOrderAppointment1762300000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'order_appointment',
                columns: [
                    { name: 'id', type: 'serial', isPrimary: true },
                    { name: 'orderId', type: 'int', isNullable: false },
                    { name: 'itemId', type: 'int', isNullable: false },
                    {
                        name: 'slotDateTime',
                        type: 'timestamptz',
                        isNullable: false,
                    },
                    {
                        name: 'assignedEmployeeId',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'attendanceStatus',
                        type: 'enum',
                        enum: ['UNKNOWN', 'SHOWED', 'NO_SHOW'],
                        enumName: 'order_appointment_attendance_status_enum',
                        default: `'UNKNOWN'`,
                    },
                    {
                        name: 'attendanceMarkedAt',
                        type: 'timestamptz',
                        isNullable: true,
                    },
                    {
                        name: 'attendanceMarkedBy',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamptz',
                        default: 'now()',
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamptz',
                        default: 'now()',
                    },
                ],
                foreignKeys: [
                    {
                        name: 'FK_order_appointment_order',
                        columnNames: ['orderId'],
                        referencedTableName: 'order',
                        referencedColumnNames: ['id'],
                        onDelete: 'CASCADE',
                    },
                ],
            }),
        );

        await queryRunner.createIndices('order_appointment', [
            new TableIndex({
                name: 'IDX_order_appointment_orderId',
                columnNames: ['orderId'],
            }),
            new TableIndex({
                name: 'IDX_order_appointment_orderId_slot',
                columnNames: ['orderId', 'slotDateTime'],
            }),
            new TableIndex({
                name: 'IDX_order_appointment_employee_slot',
                columnNames: ['assignedEmployeeId', 'slotDateTime'],
            }),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex(
            'order_appointment',
            'IDX_order_appointment_employee_slot',
        );
        await queryRunner.dropIndex(
            'order_appointment',
            'IDX_order_appointment_orderId_slot',
        );
        await queryRunner.dropIndex(
            'order_appointment',
            'IDX_order_appointment_orderId',
        );
        await queryRunner.dropTable('order_appointment');
        await queryRunner.query(
            'DROP TYPE IF EXISTS "order_appointment_attendance_status_enum"',
        );
    }
}
