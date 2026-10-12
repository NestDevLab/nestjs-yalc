/* istanbul ignore file -- Declarative TypeORM metadata is verified by the in-memory database integration test. */
import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('check_definitions')
export class CheckDefinitionEntity {
  @PrimaryColumn('text') key!: string;
  @Column('text') group!: string;
  @Column('text') title!: string;
  @Column('text') kind!: string;
  @Column('simple-json') target!: Record<string, unknown>;
  @Column('integer') intervalSeconds!: number;
  @Column('integer') timeoutMs!: number;
  @Column('text') severity!: string;
  @Column('integer', { default: 2 }) failThreshold!: number;
  @Column('integer', { default: 2 }) recoverThreshold!: number;
  @Column('simple-json', { default: '[]' }) dependsOn!: string[];
  @Column('boolean', { default: true }) enabled!: boolean;
  @Column('text', { nullable: true }) disabledReason!: string | null;
}

@Entity('check_results')
export class CheckResultEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Index() @Column('text') checkKey!: string;
  @Column('datetime') startedAt!: Date;
  @Column('integer') durationMs!: number;
  @Column('text') status!: string;
  @Column('text') summary!: string;
  @Column('simple-json', { nullable: true }) metrics!: Record<
    string,
    number
  > | null;
  @Column('text', { nullable: true }) errorClass!: string | null;
}

@Entity('check_state')
export class CheckStateEntity {
  @PrimaryColumn('text') checkKey!: string;
  @Column('text') status!: string;
  @Column('integer') since!: number;
  @Column('integer') consecutiveFail!: number;
  @Column('integer') consecutiveOk!: number;
  @Column('integer', { nullable: true }) lastOkAt!: number | null;
  @Column('simple-json') transitions!: number[];
  @Column('boolean') flapping!: boolean;
  @Column('text', { nullable: true }) openIncidentId!: string | null;
}

@Entity('incidents')
export class IncidentEntity {
  @PrimaryColumn('text') id!: string;
  @Index() @Column('text') checkKey!: string;
  @Column('text') rootKey!: string;
  @Column('text') severity!: string;
  @Column('datetime') openedAt!: Date;
  @Column('datetime', { nullable: true }) resolvedAt!: Date | null;
  @Column('text') firstSummary!: string;
  @Column('text') lastSummary!: string;
  @Column('integer', { default: 0 }) notifyCount!: number;
  @Column('datetime', { nullable: true }) lastNotifiedAt!: Date | null;
  @Column('text', { nullable: true }) ackBy!: string | null;
  @Column('datetime', { nullable: true }) ackAt!: Date | null;
  @Column('text', { nullable: true }) ackNote!: string | null;
}

@Entity('silences')
export class SilenceEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column('text') matcher!: string;
  @Column('datetime') startsAt!: Date;
  @Column('datetime') endsAt!: Date;
  @Column('text') reason!: string;
  @Column('text') createdBy!: string;
}

@Entity('alert_outbox')
export class AlertOutboxEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Index({ unique: true }) @Column('text') dedupKey!: string;
  @Column('text') kind!: string;
  @Column('text') target!: string;
  @Column('text') text!: string;
  @Column('datetime') createdAt!: Date;
  @Column('datetime', { nullable: true }) claimedAt!: Date | null;
  @Column('datetime', { nullable: true }) sentAt!: Date | null;
  @Column('integer', { default: 0 }) attempts!: number;
  @Column('text', { nullable: true }) lastError!: string | null;
}

@Entity('heartbeats')
export class HeartbeatEntity {
  @PrimaryColumn('text') source!: string;
  @Column('datetime') lastAt!: Date;
  @Column('text') payloadHash!: string;
}

export const healthEntities = [
  CheckDefinitionEntity,
  CheckResultEntity,
  CheckStateEntity,
  IncidentEntity,
  SilenceEntity,
  AlertOutboxEntity,
  HeartbeatEntity,
];
