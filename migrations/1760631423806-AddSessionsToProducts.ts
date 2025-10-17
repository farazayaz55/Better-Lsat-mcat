import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionsToProducts1760631423806 implements MigrationInterface {
    name = 'AddSessionsToProducts1760631423806';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "products" ADD "sessions" integer NOT NULL`,
        );

        // Insert seed data after sessions field is added
        await queryRunner.query(`
            INSERT INTO products (id, name, price, save, sessions, "Duration", "Description", badge) VALUES 
            (8, '15-Minute FREE Strategy Call', 0, 0, 1, 'Unlimited', 'No sales pitch. No wasted time. Just a focused strategy session to give you clarity and direction for your LSAT prep.', '{"text": "FREE", "color": "bg-green-600"}'),
            (5, '60-Minute Single Prep', 125, 75, 1, 'Unlimited', 'Need flexibility? Book individual LSAT tutoring sessions as you go', '{"text": "Only 3 slots left", "color": "bg-orange-500"}'),
            (6, '5X Prep Session Bundle', 577, 100, 5, 'Unlimited', 'Our most popular option for consistent, focused prep.', '{"text": "Most Popular", "color": "bg-blue-600"}'),
            (7, '10X Prep Session Bundle', 1100, 150, 10, 'Unlimited', 'Built for long-term gains and higher score jumps.', '{"text": "Hot Selling", "color": "bg-red-500"}')
            ON CONFLICT (id) DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "products" DROP COLUMN "sessions"`,
        );
    }
}
