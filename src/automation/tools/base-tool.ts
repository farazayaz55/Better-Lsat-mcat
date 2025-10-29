import { ToolType } from '../constants/tool-types.constant';
import { ToolPayload } from './tool-payload.interface';

export abstract class BaseTool {
  abstract readonly toolType: ToolType;
  abstract readonly name: string;
  abstract readonly description: string;

  /**
   * Send message using this communication tool
   * @param payload - Message payload with recipients and content
   */
  abstract send(payload: ToolPayload): Promise<void>;

  /**
   * Validate that the tool is properly configured
   * @returns true if configured, false otherwise
   */
  abstract isConfigured(): boolean;
}
