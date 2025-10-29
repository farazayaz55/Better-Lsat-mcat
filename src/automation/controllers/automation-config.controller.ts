import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiExtraModels,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AutomationConfigService } from '../services/automation-config.service';
import { AutomationRegistryService } from '../services/automation-registry.service';
import {
  UpdateAutomationConfigDto,
  SlackAutomationParameters,
  EmailAutomationParameters,
} from '../dto/update-automation-config.dto';
import { AutomationConfigOutputDto } from '../dto/automation-config-output.dto';
import {
  SlackPlaceholdersResponseDto,
  SlackPlaceholderOutputDto,
} from '../dto/slack-placeholders-output.dto';
import { SLACK_PLACEHOLDERS } from '../constants/slack-placeholders.constant';
import { EMAIL_PLACEHOLDERS } from '../constants/email-placeholders.constant';
import { SMS_PLACEHOLDERS } from '../constants/sms-placeholders.constant';
import { AutomationConfig } from '../entities/automation-config.entity';
import { AutomationLog } from '../entities/automation-log.entity';
import {
  BaseApiResponse,
  BaseApiErrorResponse,
  swaggerBaseApiResponse,
} from '../../shared/dtos/base-api-response.dto';

@ApiTags('automation')
@ApiExtraModels(
  SlackPlaceholdersResponseDto,
  SlackPlaceholderOutputDto,
  SlackAutomationParameters,
  EmailAutomationParameters,
)
@Controller('automation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AutomationConfigController {
  constructor(
    private configService: AutomationConfigService,
    private registry: AutomationRegistryService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List all automations with their configurations',
    description:
      'Returns all available automations with their current configuration. Includes enabled/disabled status and parameters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved all automations',
    type: swaggerBaseApiResponse([AutomationConfigOutputDto]),
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: BaseApiErrorResponse,
  })
  async listAll(): Promise<BaseApiResponse<AutomationConfigOutputDto[]>> {
    const automations = this.registry.getAll();
    const configs = await this.configService.getAll();

    const data = automations.map((automation) => {
      const config = configs.find((c) => c.automationKey === automation.key);

      // Merge saved config parameters with default parameters
      // This ensures any new fields in defaultParameters are included
      const parameters = config?.parameters
        ? { ...automation.defaultParameters, ...config.parameters }
        : automation.defaultParameters;

      return {
        key: automation.key,
        name: automation.name,
        description: automation.description,
        triggerEvent: automation.triggerEvent,
        toolType: automation.toolType,
        isEnabled: config?.isEnabled ?? false,
        parameters,
      };
    });

    return { data, meta: { count: data.length } };
  }

  @Get('logs')
  @ApiOperation({
    summary: 'Get all automation execution logs',
    description:
      'Retrieve execution history for all automations. Returns last 100 logs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved all automation logs',
    type: swaggerBaseApiResponse([AutomationLog]),
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: BaseApiErrorResponse,
  })
  async getAllLogs(): Promise<BaseApiResponse<AutomationLog[]>> {
    const data = await this.configService.getAllLogs();
    return { data, meta: { count: data.length } };
  }

  @Get('placeholders/slack')
  @ApiOperation({
    summary: 'Get available placeholders for Slack automations',
    description:
      'Returns list of available placeholders that can be used in customMessage and customBlockMessage parameters. Use {{placeholder}} format in messages.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved Slack placeholders',
    type: swaggerBaseApiResponse(SlackPlaceholdersResponseDto),
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: BaseApiErrorResponse,
  })
  async getSlackPlaceholders(): Promise<
    BaseApiResponse<SlackPlaceholdersResponseDto>
  > {
    const data = {
      placeholders: SLACK_PLACEHOLDERS,
      example:
        'Use {{orderId}} in your message template like: "New order #{{orderId}} from {{customerName}}"',
    };
    return { data, meta: {} };
  }

  @Get('placeholders/email')
  @ApiOperation({
    summary: 'Get available placeholders for Email automations',
    description:
      'Returns list of available placeholders that can be used in subject and message parameters. Use {{placeholder}} format in messages.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved Email placeholders',
    type: swaggerBaseApiResponse(SlackPlaceholdersResponseDto),
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: BaseApiErrorResponse,
  })
  async getEmailPlaceholders(): Promise<
    BaseApiResponse<SlackPlaceholdersResponseDto>
  > {
    const data = {
      placeholders: EMAIL_PLACEHOLDERS,
      example:
        'Use {{orderNumber}} in your message template like: "Your order #{{orderNumber}} has been confirmed - ${{total}}"',
    };
    return { data, meta: {} };
  }

  @Get('placeholders/sms')
  @ApiOperation({
    summary: 'Get available placeholders for SMS automations',
    description:
      'Returns list of available placeholders that can be used in message parameters. Use {{placeholder}} format in messages.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved SMS placeholders',
    type: swaggerBaseApiResponse(SlackPlaceholdersResponseDto),
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: BaseApiErrorResponse,
  })
  async getSmsPlaceholders(): Promise<
    BaseApiResponse<SlackPlaceholdersResponseDto>
  > {
    const placeholderArray = Object.values(SMS_PLACEHOLDERS).map((p) => ({
      placeholder: p.key,
      description: p.description,
      example: p.example,
    }));
    const data = {
      placeholders: placeholderArray,
      example:
        'Use {{customerName}} and {{orderNumber}} in your message template like: "Hi {{customerName}}! Your order #{{orderNumber}} is confirmed."',
    };
    return { data, meta: {} };
  }

  @Get(':key')
  @ApiOperation({
    summary: 'Get specific automation configuration',
    description: 'Retrieve configuration for a specific automation by its key',
  })
  @ApiParam({
    name: 'key',
    description:
      'Automation key (e.g., slack-new-order, order-confirmation-email)',
    example: 'slack-new-order',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved automation configuration',
    type: swaggerBaseApiResponse(AutomationConfigOutputDto),
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Automation not found',
    type: BaseApiErrorResponse,
  })
  async getOne(
    @Param('key') key: string,
  ): Promise<BaseApiResponse<AutomationConfigOutputDto | null>> {
    const automation = this.registry.getByKey(key);
    const config = await this.configService.getByKey(key);

    if (!automation) {
      return { data: null, meta: {} };
    }

    // Merge saved config parameters with default parameters
    const parameters = config?.parameters
      ? { ...automation.defaultParameters, ...config.parameters }
      : automation.defaultParameters;

    const data: AutomationConfigOutputDto = {
      key: automation.key,
      name: automation.name,
      description: automation.description,
      triggerEvent: automation.triggerEvent,
      toolType: automation.toolType,
      isEnabled: config?.isEnabled ?? false,
      parameters,
    };

    return { data, meta: {} };
  }

  @Patch(':key')
  @ApiOperation({
    summary: 'Update automation configuration',
    description:
      'Enable/disable automation or modify its parameters. Use ToolType and TriggerEvent enums for reference.',
  })
  @ApiParam({
    name: 'key',
    description: 'Automation key',
    example: 'slack-new-order',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully updated automation configuration',
    type: swaggerBaseApiResponse(AutomationConfig),
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Automation not found',
    type: BaseApiErrorResponse,
  })
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateAutomationConfigDto,
  ): Promise<BaseApiResponse<AutomationConfig>> {
    // Check if automation exists in registry
    const automation = this.registry.getByKey(key);
    if (!automation) {
      throw new NotFoundException(`Automation with key '${key}' not found`);
    }

    // Get or create config for this automation
    let config = await this.configService.getByKey(key);
    if (!config) {
      // Create config with default parameters from automation
      config = await this.configService.getOrCreate(key, automation);
    }

    // Update the config
    const data = await this.configService.update(key, dto);
    return { data, meta: {} };
  }

  @Get(':key/logs')
  @ApiOperation({
    summary: 'Get automation execution logs',
    description:
      'Retrieve execution history for a specific automation. Returns last 100 logs.',
  })
  @ApiParam({
    name: 'key',
    description: 'Automation key',
    example: 'slack-new-order',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved automation logs',
    type: swaggerBaseApiResponse([AutomationLog]),
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: BaseApiErrorResponse,
  })
  async getLogs(
    @Param('key') key: string,
  ): Promise<BaseApiResponse<AutomationLog[]>> {
    const data = await this.configService.getLogs(key);
    return { data, meta: { count: data.length } };
  }
}
