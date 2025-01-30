// Event names used across the plugin
export const PLUGIN_EVENTS = {
    CARD_UPDATED: 'memmaster:card-updated',
    CARD_CREATED: 'memmaster:card-created',
    CARD_DELETED: 'memmaster:card-deleted',
    SETTINGS_UPDATED: 'memmaster:settings-updated',
} as const;

// Type for event names
export type PluginEventName = typeof PLUGIN_EVENTS[keyof typeof PLUGIN_EVENTS];