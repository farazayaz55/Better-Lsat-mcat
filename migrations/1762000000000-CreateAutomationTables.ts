import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateAutomationTables1762000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create automation_config table
        await queryRunner.createTable(
            new Table({
                name: 'automation_config',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'automationKey',
                        type: 'varchar',
                        length: '100',
                        isUnique: true,
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        length: '200',
                    },
                    {
                        name: 'description',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'triggerEvent',
                        type: 'varchar',
                        length: '50',
                    },
                    {
                        name: 'toolType',
                        type: 'varchar',
                        length: '20',
                    },
                    {
                        name: 'isEnabled',
                        type: 'boolean',
                        default: false,
                    },
                    {
                        name: 'parameters',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        // Create automation_log table
        await queryRunner.createTable(
            new Table({
                name: 'automation_log',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'automationKey',
                        type: 'varchar',
                        length: '100',
                    },
                    {
                        name: 'triggerEvent',
                        type: 'varchar',
                        length: '50',
                    },
                    {
                        name: 'toolType',
                        type: 'varchar',
                        length: '20',
                        isNullable: true,
                    },
                    {
                        name: 'eventData',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '20',
                        default: "'pending'",
                    },
                    {
                        name: 'error',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'executedAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        // Seed initial automation configs
        const slackParams = JSON.stringify({
            delayMinutes: 0,
            channel: '#orders',
            customMessage:
                '🎉 New order #{{orderId}} from {{customerName}} - ${{total}}',
            customBlockMessage: 'New Order #{{orderId}}',
        });

        await queryRunner.query(
            `
      INSERT INTO automation_config ("automationKey", "name", "description", "triggerEvent", "toolType", "isEnabled", "parameters") VALUES
      ('order-confirmation-email', 'Order Confirmation Email', 'Sends immediate confirmation email when order is created', 'order.created', 'email', false, '{"delayMinutes": 0, "ccRecipients": [], "template": "order-confirmation"}'),
      ('reminder-24h-email', '24 Hour Reminder Email', 'Sends reminder email 24 hours after order is paid', 'order.paid', 'email', false, '{"delayMinutes": 1440, "template": "reminder-24h"}'),
      ('reminder-3day-sms', '3 Day Reminder SMS', 'Sends reminder SMS 3 days after order is paid', 'order.paid', 'sms', false, '{"delayMinutes": 4320}'),
      ('slack-new-order', 'Slack New Order Notification', 'Sends Slack notification when new order is created', 'order.created', 'slack', false, $1);
    `,
            [slackParams],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('automation_log');
        await queryRunner.dropTable('automation_config');
    }
}
