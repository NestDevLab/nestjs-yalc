export type EventType = 'EventType';
export const EventType = 'EventType' as const;

export interface IUtilsProperties {
  base: string;
  all: string;
}

type ActionValues = {
  [key: string]: 'EventType' | Record<string, 'EventType'>;
};

export type Events<Actions extends ActionValues | unknown> = {
  [K in keyof Actions]: {
    [L in keyof Actions[K]]: Actions[K][L] extends 'EventType' ? string : never;
  } & IUtilsProperties;
} & IUtilsProperties;

export abstract class EventNameBuilder {
  static version: IUtilsProperties;
  static $: Events<unknown>;

  static events<Actions extends ActionValues>(
    domain: string,
    actions: Actions,
  ): Events<Actions> {
    const baseEvent = `${
      this.version?.base ? this.version?.base + '.' : ''
    }${domain}`;

    const actionsWithBaseEvent: Record<string, any> = {};
    for (const [actionKey, actionValue] of Object.entries(actions)) {
      actionsWithBaseEvent[actionKey] = {
        base: `${baseEvent}.${actionKey}`,
        all: `${baseEvent}.${actionKey}.**`,
      };
      for (const [eventKey, eventValue] of Object.entries(
        actionValue as object,
      )) {
        if (eventValue === EventType) {
          actionsWithBaseEvent[actionKey][eventKey] =
            `${baseEvent}.${actionKey}.${eventKey}`;
        } else {
          actionsWithBaseEvent[actionKey][eventKey] = eventValue;
        }
      }
    }

    actionsWithBaseEvent.base = baseEvent;
    actionsWithBaseEvent.all = `${baseEvent}.**`;

    return actionsWithBaseEvent as Events<Actions>;
  }
}
