import { Injectable } from '@nestjs/common';
import { BaseTool } from '../tools/base-tool';
import { ToolType } from '../constants/tool-types.constant';
import { EmailTool } from '../tools/email/email.tool';
import { SmsTool } from '../tools/sms/sms.tool';
import { SlackTool } from '../tools/slack/slack.tool';

@Injectable()
export class ToolRegistryService {
  private tools = new Map<ToolType, BaseTool>();

  constructor(
    private emailTool: EmailTool,
    private smsTool: SmsTool,
    private slackTool: SlackTool,
  ) {
    // Auto-register all tools
    this.register(emailTool);
    this.register(smsTool);
    this.register(slackTool);
  }

  private register(tool: BaseTool): void {
    this.tools.set(tool.toolType, tool);
  }

  getTool(toolType: ToolType): BaseTool {
    const tool = this.tools.get(toolType);
    if (!tool) {
      throw new Error(`Tool ${toolType} not found in registry`);
    }
    return tool;
  }

  getAllTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getConfiguredTools(): BaseTool[] {
    return this.getAllTools().filter((tool) => tool.isConfigured());
  }
}
