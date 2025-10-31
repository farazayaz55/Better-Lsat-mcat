import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseTool } from '../base-tool';
import { ToolType } from '../../constants/tool-types.constant';
import { ToolPayload } from '../tool-payload.interface';

@Injectable()
export class EmailTool extends BaseTool {
  readonly toolType = ToolType.EMAIL;
  readonly name = 'Email';
  readonly description = 'Send emails via SMTP';

  private readonly logger = new Logger(EmailTool.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    super();
    this.initializeHandlebars();
    this.initializeTransporter();
  }

  private initializeHandlebars(): void {
    // Register multiply helper for Handlebars
    Handlebars.registerHelper('multiply', function (a: number, b: number) {
      return (a * b).toFixed(2);
    });
  }

  private initializeTransporter(): void {
    const host = this.configService.get('SMTP_HOST');
    const port = this.configService.get('SMTP_PORT');
    const user = this.configService.get('SMTP_USER');
    const pass = this.configService.get('SMTP_PASS');

    if (!host || !port || !user || !pass) {
      this.logger.warn(
        'Email tool not fully configured - SMTP credentials missing',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number.parseInt(port, 10),
      secure: false,
      auth: {
        user,
        pass,
      },
    });
  }

  async send(payload: ToolPayload): Promise<void> {
    try {
      this.logger.log(
        `[EmailTool] Received payload. Template: ${payload.template || 'none'}, Has data: ${!!payload.data}`,
      );
      let html: string;

      if (payload.template) {
        this.logger.log(`Rendering email template: ${payload.template}`);
        try {
          html = this.renderTemplate(payload.template, payload.data || {});
        } catch (templateError) {
          this.logger.warn(
            `Template rendering failed, falling back to plain text: ${templateError instanceof Error ? templateError.message : 'Unknown error'}`,
          );
          html = payload.message || '';
        }
      } else {
        this.logger.log('No template specified, using plain text message');
        html = payload.message || '';
      }

      const recipients = Array.isArray(payload.recipients)
        ? payload.recipients.join(',')
        : payload.recipients;

      this.logger.log(
        `Sending email to ${recipients} with subject: ${payload.subject || 'Notification'}`,
      );

      await this.transporter.sendMail({
        from: `${this.configService.get('SMTP_FROM_NAME') || 'Better LSAT MCAT'} <${this.configService.get('SMTP_FROM_EMAIL') || 'noreply@betterlsatmcat.com'}>`,
        to: recipients,
        subject: payload.subject || 'Notification',
        html,
        text: payload.message || html.replace(/<[^>]*>/g, ''), // Fallback plain text by stripping HTML
      });

      this.logger.log(`Email sent successfully to ${recipients}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  private renderTemplate(
    templateName: string,
    data: Record<string, any>,
  ): string {
    try {
      // In production (dist), templates are in dist/src/automation/tools/email/templates/
      // In development (src), templates are in src/automation/tools/email/templates/
      // Try both locations
      let templatePath = path.join(
        __dirname,
        'templates',
        `${templateName}.hbs`,
      );

      if (!fs.existsSync(templatePath)) {
        // Try dist location
        templatePath = path.join(
          __dirname,
          '../../../../../src/automation/tools/email/templates',
          `${templateName}.hbs`,
        );
      }

      if (!fs.existsSync(templatePath)) {
        // Try src location from dist
        templatePath = path.join(
          process.cwd(),
          'src',
          'automation',
          'tools',
          'email',
          'templates',
          `${templateName}.hbs`,
        );
      }

      if (!fs.existsSync(templatePath)) {
        this.logger.error(
          `Template file not found: ${templateName}.hbs. Tried: ${templatePath}`,
        );
        throw new Error(`Template ${templateName} not found`);
      }

      this.logger.log(`Loading template from: ${templatePath}`);
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const compiled = Handlebars.compile(templateSource);
      const rendered = compiled(data);
      this.logger.log(`Template ${templateName} rendered successfully`);
      return rendered;
    } catch (error) {
      this.logger.error(
        `Failed to render template ${templateName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Throw error instead of returning JSON so caller knows it failed
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!(
      this.configService.get('SMTP_HOST') &&
      this.configService.get('SMTP_PORT') &&
      this.configService.get('SMTP_USER') &&
      this.configService.get('SMTP_PASS')
    );
  }
}
