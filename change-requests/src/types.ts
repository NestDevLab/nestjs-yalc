export type ChangeRequestActor = {
  kind: 'human' | 'ai' | 'agent';
  id?: string;
  label: string;
};
export type ChangeRequestItemInput = {
  fieldKey: string;
  variant?: string;
  proposedValue: unknown;
};
export type ChangeRequestItemRef = Pick<
  ChangeRequestItemInput,
  'fieldKey' | 'variant'
>;
export type ChangeRequestLiveValue = {
  fieldKey: string;
  variant: string;
  value: unknown;
};
export type ChangeRequestApplyItem = ChangeRequestLiveValue;

export interface ChangeRequestAdapter {
  entityType: string;
  target: string;
  describe(entityId: string): Promise<unknown>;
  read(
    entityId: string,
    items: ChangeRequestItemRef[],
  ): Promise<ChangeRequestLiveValue[]>;
  validate(entityId: string, items: ChangeRequestItemInput[]): Promise<void>;
  apply(
    entityId: string,
    items: ChangeRequestApplyItem[],
    actor: ChangeRequestActor,
  ): Promise<void>;
}

export type CreateChangeRequest = {
  entityType: string;
  target: string;
  entityId: string;
  proposer: ChangeRequestActor;
  source?: unknown;
  title?: string;
  note?: string;
  items: ChangeRequestItemInput[];
};

export type ChangeRequestListFilter = {
  entityType?: string;
  target?: string;
  entityId?: string;
  state?: 'proposed' | 'stale' | 'publish_failed';
  offset?: number;
  limit?: number;
};

export type ChangeRequestItemResult = {
  itemId: string;
  status:
    | 'published'
    | 'stale'
    | 'publish_failed'
    | 'rejected'
    | 'alreadyResolved';
};
