import { ClassType } from '@nestjs-yalc/types/globals.d.js';

class DefaultBase {}

export interface PluginMethods extends Record<
  string,
  { (...args: any[]): void } | undefined
> {}

export interface Plugin<T extends PluginMethods> {
  pluginMethods: T;
}

export interface PluginSystem<T extends PluginMethods> {
  registerPlugin(plugin: Plugin<T>): void;
  unregisterPlugin(plugin: Plugin<T>): void;
  invokePlugins(methodName: keyof T, ...args: any[]): void;
}

export function WithPluginSystem<U extends PluginMethods>(
  Base: ClassType = DefaultBase,
) {
  class PluginSystemWrapper extends Base implements PluginSystem<U> {
    plugins: Plugin<U>[] = [];

    registerPlugin(plugin: Plugin<U>) {
      this.plugins.push(plugin);
    }

    unregisterPlugin(plugin: Plugin<U>) {
      this.plugins = this.plugins.filter((p) => p !== plugin);
    }

    invokePlugins(methodName: keyof U, ...args: any[]) {
      for (const plugin of this.plugins) {
        plugin.pluginMethods[methodName]?.(...args);
      }
    }
  }

  return PluginSystemWrapper;
}
