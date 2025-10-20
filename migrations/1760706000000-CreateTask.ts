import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTask1760706000000 implements MigrationInterface {
    name = 'CreateTask1760706000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."tasks_label_enum" AS ENUM('meeting', 'personal', 'preparation', 'grading')`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_priority_enum" AS ENUM('low', 'medium', 'high')`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_status_enum" AS ENUM('pending', 'in_progress', 'completed', 'cancelled')`);
        
        await queryRunner.query(`CREATE TABLE "tasks" (
            "id" SERIAL NOT NULL,
            "title" character varying(200) NOT NULL,
            "description" text,
            "startDateTime" TIMESTAMP NOT NULL,
            "endDateTime" TIMESTAMP NOT NULL,
            "tutorId" integer NOT NULL,
            "googleCalendarEventId" character varying,
            "label" "public"."tasks_label_enum" NOT NULL,
            "priority" "public"."tasks_priority_enum" NOT NULL DEFAULT 'medium',
            "status" "public"."tasks_status_enum" NOT NULL DEFAULT 'pending',
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_8d0ff2e5c314ed2d096ed03da4b" PRIMARY KEY ("id")
        )`);
        
        await queryRunner.query(`CREATE INDEX "IDX_tasks_tutorId" ON "tasks" ("tutorId")`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_tutorId" FOREIGN KEY ("tutorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_tutorId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tasks_tutorId"`);
        await queryRunner.query(`DROP TABLE "tasks"`);
        await queryRunner.query(`DROP TYPE "public"."tasks_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tasks_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tasks_label_enum"`);
    }
}
