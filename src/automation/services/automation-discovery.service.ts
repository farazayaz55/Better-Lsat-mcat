import { Injectable } from '@nestjs/common';
import { BaseAutomation } from '../automations/base-automation';
import { AutomationRegistryService } from './automation-registry.service';

/**
 * Factory object that collects all automations and registers them
 * Simplifies registration by accepting an array of automations
 */
export const AutomationDiscoveryService = {
  /**
   * Registers all provided automations with the registry
   * This method is called by the module's factory provider
   */
  registerAutomations(
    registry: AutomationRegistryService,
    automations: BaseAutomation[],
  ): void {
    for (const automation of automations) {
      registry.register(automation);
    }
  },
};
