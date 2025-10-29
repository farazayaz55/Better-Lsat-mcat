import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationConfig } from '../entities/automation-config.entity';
import { AutomationLog } from '../entities/automation-log.entity';
import { UpdateAutomationConfigDto } from '../dto/update-automation-config.dto';

@Injectable()
export class AutomationConfigService {
  constructor(
    @InjectRepository(AutomationConfig)
    private configRepository: Repository<AutomationConfig>,
    @InjectRepository(AutomationLog)
    private logRepository: Repository<AutomationLog>,
  ) {}

  async getAll(): Promise<AutomationConfig[]> {
    return this.configRepository.find();
  }

  async getByKey(key: string): Promise<AutomationConfig | null> {
    return this.configRepository.findOne({ where: { automationKey: key } });
  }

  async getOrCreate(key: string, automation: any): Promise<AutomationConfig> {
    let config = await this.getByKey(key);

    if (!config) {
      // Enable reminder automations by default (24h and 30min)
      const isReminderAutomation =
        key.includes('24h') ||
        key.includes('30min') ||
        key.includes('reminder');

      config = this.configRepository.create({
        automationKey: key,
        name: automation.name,
        description: automation.description,
        triggerEvent: automation.triggerEvent,
        toolType: automation.toolType,
        isEnabled: isReminderAutomation, // Enable reminders by default
        parameters: automation.defaultParameters,
      });
      return this.configRepository.save(config);
    }

    return config;
  }

  async update(
    key: string,
    dto: UpdateAutomationConfigDto,
  ): Promise<AutomationConfig> {
    const config = await this.getByKey(key);

    if (!config) {
      throw new NotFoundException(`Automation config for ${key} not found`);
    }

    if (dto.isEnabled !== undefined) {
      config.isEnabled = dto.isEnabled;
    }

    if (dto.parameters) {
      config.parameters = { ...config.parameters, ...dto.parameters };
    }

    return this.configRepository.save(config);
  }

  async getLogs(key: string): Promise<AutomationLog[]> {
    return this.logRepository.find({
      where: { automationKey: key },
      order: { executedAt: 'DESC' },
      take: 100, // Limit to last 100 logs
    });
  }

  async getAllLogs(): Promise<AutomationLog[]> {
    return this.logRepository.find({
      order: { executedAt: 'DESC' },
      take: 100, // Limit to last 100 logs
    });
  }

  async createLog(log: Partial<AutomationLog>): Promise<AutomationLog> {
    const automationLog = this.logRepository.create(log);
    return this.logRepository.save(automationLog);
  }

  /**
   * Enable all reminder automations (24h and 30min)
   * This can be called to enable reminder automations that were previously disabled
   */
  async enableReminderAutomations(): Promise<number> {
    const reminderKeys = [
      'reminder-24h-email',
      'reminder-24h-sms',
      'reminder-30min-email',
      'reminder-30min-sms',
    ];

    let enabledCount = 0;
    for (const key of reminderKeys) {
      const config = await this.getByKey(key);
      if (config && !config.isEnabled) {
        config.isEnabled = true;
        await this.configRepository.save(config);
        enabledCount++;
      }
    }

    return enabledCount;
  }
}
