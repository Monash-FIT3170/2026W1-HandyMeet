import {
  isLiveInsightsCoordinatorClaim,
  isLiveInsightsCoordinatorHandoff,
  isLiveInsightsCoordinatorState,
  isLiveInsightsCoordinatorStateRequest,
  isLiveInsightsSnapshotRequest,
  LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE,
  LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE,
  LIVE_INSIGHTS_COORDINATOR_STATE_REQUEST_TYPE,
  LIVE_INSIGHTS_COORDINATOR_STATE_TYPE,
  LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE,
} from './liveInsightsProtocol';

describe.each([
  [
    'snapshot request',
    isLiveInsightsSnapshotRequest,
    LIVE_INSIGHTS_SNAPSHOT_REQUEST_TYPE,
  ],
  [
    'coordinator state request',
    isLiveInsightsCoordinatorStateRequest,
    LIVE_INSIGHTS_COORDINATOR_STATE_REQUEST_TYPE,
  ],
])('%s', (_name, validate, type) => {
  test('accepts its message type without other fields', () => {
    expect(validate({ type })).toBe(true);
  });

  test.each([null, undefined, false, 1, 'request', [], {}, { type: 'other' }])(
    'rejects an invalid request: %p',
    (value) => {
      expect(validate(value)).toBe(false);
    },
  );
});

describe('isLiveInsightsCoordinatorClaim', () => {
  test.each([0, 1792713600000])(
    'accepts a finite join time of %p',
    (joinedAt) => {
      expect(
        isLiveInsightsCoordinatorClaim({
          type: LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE,
          joinedAt,
        }),
      ).toBe(true);
    },
  );

  test.each([undefined, null, '0', -1, NaN, Infinity, -Infinity])(
    'rejects an invalid join time: %p',
    (joinedAt) => {
      expect(
        isLiveInsightsCoordinatorClaim({
          type: LIVE_INSIGHTS_COORDINATOR_CLAIM_TYPE,
          joinedAt,
        }),
      ).toBe(false);
    },
  );

  test.each([
    null,
    undefined,
    1,
    'claim',
    [],
    {},
    { type: 'other', joinedAt: 0 },
  ])('rejects a malformed claim: %p', (value) => {
    expect(isLiveInsightsCoordinatorClaim(value)).toBe(false);
  });
});

describe('isLiveInsightsCoordinatorHandoff', () => {
  test('accepts a named target', () => {
    expect(
      isLiveInsightsCoordinatorHandoff({
        type: LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE,
        targetIdentity: 'participant-2',
      }),
    ).toBe(true);
  });

  test.each([undefined, null, '', 1, {}])(
    'rejects an invalid target: %p',
    (targetIdentity) => {
      expect(
        isLiveInsightsCoordinatorHandoff({
          type: LIVE_INSIGHTS_COORDINATOR_HANDOFF_TYPE,
          targetIdentity,
        }),
      ).toBe(false);
    },
  );

  test.each([
    null,
    undefined,
    false,
    'handoff',
    [],
    {},
    { type: 'other', targetIdentity: 'participant-2' },
  ])('rejects a malformed handoff: %p', (value) => {
    expect(isLiveInsightsCoordinatorHandoff(value)).toBe(false);
  });
});

describe('isLiveInsightsCoordinatorState', () => {
  test.each(['participant-1', null])(
    'accepts coordinator identity %p',
    (coordinatorIdentity) => {
      expect(
        isLiveInsightsCoordinatorState({
          type: LIVE_INSIGHTS_COORDINATOR_STATE_TYPE,
          coordinatorIdentity,
        }),
      ).toBe(true);
    },
  );

  test.each([undefined, 1, false, {}])(
    'rejects an invalid coordinator identity: %p',
    (coordinatorIdentity) => {
      expect(
        isLiveInsightsCoordinatorState({
          type: LIVE_INSIGHTS_COORDINATOR_STATE_TYPE,
          coordinatorIdentity,
        }),
      ).toBe(false);
    },
  );

  test.each([
    null,
    undefined,
    1,
    'state',
    [],
    {},
    { type: 'other', coordinatorIdentity: null },
  ])('rejects a malformed state: %p', (value) => {
    expect(isLiveInsightsCoordinatorState(value)).toBe(false);
  });
});
