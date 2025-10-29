import { TriggerEvent } from '../constants/trigger-events.constant';
import { ToolType } from '../constants/tool-types.constant';
import { ToolPayload } from '../tools/tool-payload.interface';

export abstract class BaseAutomation {
  abstract readonly key: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly triggerEvent: TriggerEvent;
  abstract readonly toolType: ToolType;
  abstract readonly defaultParameters: Record<string, any>;

  /**
   * Build the payload for the communication tool
   * @param eventData - Data from the triggered event
   * @param parameters - User-configured parameters
   * @returns Tool payload or null to skip execution
   */
  abstract buildPayload(
    eventData: any,
    parameters: Record<string, any>,
  ): Promise<ToolPayload | null>;
}
