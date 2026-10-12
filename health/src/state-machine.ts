import type { CheckState, TransitionInput, TransitionOutput } from './types.js';

const HOUR = 60 * 60 * 1000;
const STABLE = 30 * 60 * 1000;

export function initialCheckState(now: number): CheckState {
  return {
    status: 'unknown',
    since: now,
    consecutiveFail: 0,
    consecutiveOk: 0,
    transitions: [],
    flapping: false,
  };
}

export function transitionCheck(input: TransitionInput): TransitionOutput {
  const { now, result } = input;
  const state: CheckState = {
    ...input.state,
    transitions: input.state.transitions.filter((at) => at > now - HOUR),
  };
  const previous = state.status;
  let event: TransitionOutput['event'] = null;
  let recoveredIncidentId: string | undefined;

  if (result.status === 'disabled') {
    state.status = 'disabled';
    state.consecutiveFail = 0;
    state.consecutiveOk = 0;
  } else if (input.parentFailing) {
    state.status = 'blocked';
    state.consecutiveFail = 0;
    state.consecutiveOk = 0;
  } else if (input.graceUntil !== undefined && now < input.graceUntil) {
    state.status = 'unknown';
    state.consecutiveFail = 0;
    state.consecutiveOk = 0;
  } else if (result.status === 'ok') {
    state.lastOkAt = now;
    state.consecutiveOk += 1;
    state.consecutiveFail = 0;
    if (
      state.openIncidentId &&
      state.consecutiveOk >= (input.recoverThreshold ?? 2)
    ) {
      state.status = 'ok';
      recoveredIncidentId = state.openIncidentId;
      state.openIncidentId = undefined;
      event = 'recover';
    } else if (!state.openIncidentId) {
      state.status = 'ok';
    }
  } else if (result.status === 'fail' || result.status === 'warn') {
    state.consecutiveFail += 1;
    state.consecutiveOk = 0;
    if (
      !state.openIncidentId &&
      state.consecutiveFail >= (input.failThreshold ?? 2)
    ) {
      state.status = result.status;
      state.openIncidentId = input.incidentId ?? `${now}`;
      event = 'open';
    } else if (!state.openIncidentId) {
      state.status = 'unknown';
    }
  } else {
    state.status = 'unknown';
  }

  if (state.status !== previous) {
    state.since = now;
    state.transitions.push(now);
    state.stableSince = now;
  }
  if (!state.flapping && state.transitions.length >= 4) {
    state.flapping = true;
    event = 'flapping';
  } else if (
    state.flapping &&
    state.stableSince !== undefined &&
    now - state.stableSince >= STABLE
  ) {
    state.flapping = false;
  } else if (state.flapping) {
    event = null;
  }
  return { state, event, recoveredIncidentId };
}
