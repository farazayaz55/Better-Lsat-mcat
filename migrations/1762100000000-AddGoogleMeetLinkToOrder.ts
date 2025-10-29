import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleMeetLinkToOrder1762100000000
    implements MigrationInterface
{
    name = 'AddGoogleMeetLinkToOrder1762100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE "order" 
      ADD COLUMN "googleMeetLink" character varying(500) NULL
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE "order" 
      DROP COLUMN "googleMeetLink"
    `);
    }
}
