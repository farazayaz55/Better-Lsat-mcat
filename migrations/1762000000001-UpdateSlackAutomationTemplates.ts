import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSlackAutomationTemplates1762000000001
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Update slack-new-order automation with template parameters
        const slackParams = JSON.stringify({
            delayMinutes: 0,
            channel: '#orders',
            customMessage:
                '🎉 New order #{{orderId}} from {{customerName}} - ${{total}}',
            customBlockMessage: 'New Order #{{orderId}}',
        });

        await queryRunner.query(
            `UPDATE automation_config SET parameters = $1::jsonb WHERE "automationKey" = 'slack-new-order'`,
            [slackParams],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert to basic parameters
        const basicParams = JSON.stringify({
            delayMinutes: 0,
            channel: '#orders',
        });

        await queryRunner.query(
            `UPDATE automation_config SET parameters = $1::jsonb WHERE "automationKey" = 'slack-new-order'`,
            [basicParams],
        );
    }
}
