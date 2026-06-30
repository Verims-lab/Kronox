export const JOKER_SPEND_MERGE_TYPES = Object.freeze([
  'mistake_shield',
  'card_swap',
  'time_freeze',
]);

export const JOKER_SPEND_MERGE_UI_TO_INVENTORY_TYPE = Object.freeze({
  mistakeShield: 'mistake_shield',
  swapCard: 'card_swap',
  freezeTime: 'time_freeze',
});

export function isKnownJokerSpendMergeType(jokerType) {
  return JOKER_SPEND_MERGE_TYPES.includes(String(jokerType || '').trim());
}

export function normalizeJokerSpendMergeType(jokerType) {
  const directType = String(jokerType || '').trim();
  const mappedType = JOKER_SPEND_MERGE_UI_TO_INVENTORY_TYPE[directType] || directType;
  return isKnownJokerSpendMergeType(mappedType) ? mappedType : '';
}

export function normalizeJokerSpendMergeQuantity(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

export function emptyJokerSpendMergeBalances(fill = 0) {
  return JOKER_SPEND_MERGE_TYPES.reduce((balances, jokerType) => {
    balances[jokerType] = normalizeJokerSpendMergeQuantity(fill);
    return balances;
  }, {});
}

export function normalizeJokerSpendMergeBalances(input) {
  const balances = emptyJokerSpendMergeBalances();
  if (Array.isArray(input)) {
    input.forEach((row) => {
      const jokerType = normalizeJokerSpendMergeType(row?.joker_type || row?.jokerType || row?.type);
      if (jokerType) {
        balances[jokerType] = Math.max(
          balances[jokerType],
          normalizeJokerSpendMergeQuantity(row?.quantity),
        );
      }
    });
    return balances;
  }
  if (input && typeof input === 'object') {
    JOKER_SPEND_MERGE_TYPES.forEach((jokerType) => {
      balances[jokerType] = normalizeJokerSpendMergeQuantity(input[jokerType]);
    });
  }
  return balances;
}

export function getJokerBalancePayloadTypes(input) {
  if (Array.isArray(input)) {
    return Array.from(new Set(input
      .map((row) => normalizeJokerSpendMergeType(row?.joker_type || row?.jokerType || row?.type))
      .filter(Boolean)));
  }
  if (input && typeof input === 'object') {
    return JOKER_SPEND_MERGE_TYPES
      .filter((jokerType) => Object.prototype.hasOwnProperty.call(input, jokerType));
  }
  return [];
}

export function getJokerSpendBalancePayloadTypes(response, selectedJokerType = '') {
  const selectedInventoryType = normalizeJokerSpendMergeType(selectedJokerType);
  const balanceAfter = response?.balanceAfter
    ?? response?.balance_after
    ?? response?.updatedCount
    ?? response?.updated_count
    ?? response?.inventory?.quantity;
  const explicitTypes = Array.isArray(response?.balancePayloadTypes)
    ? response.balancePayloadTypes.map(normalizeJokerSpendMergeType).filter(Boolean)
    : [];
  const shouldTrustAllBalanceKeys = explicitTypes.length > 0
    || response?.balancesComplete === true
    || !selectedInventoryType
    || balanceAfter === undefined
    || balanceAfter === null;
  const types = new Set(shouldTrustAllBalanceKeys ? [
    ...(explicitTypes.length ? explicitTypes : getJokerBalancePayloadTypes(response?.balances)),
    ...getJokerBalancePayloadTypes(response?.items),
  ] : []);
  if (selectedInventoryType && balanceAfter !== undefined && balanceAfter !== null) {
    types.add(selectedInventoryType);
  }
  return JOKER_SPEND_MERGE_TYPES.filter((jokerType) => types.has(jokerType));
}

export function mergeJokerBalancesByPayloadTypes(baseBalances, incomingBalances, payloadTypes = null) {
  const nextBalances = normalizeJokerSpendMergeBalances(baseBalances);
  const incomingTypes = getJokerBalancePayloadTypes(incomingBalances);
  const allowedTypes = Array.isArray(payloadTypes) && payloadTypes.length
    ? new Set(payloadTypes.map(normalizeJokerSpendMergeType).filter(Boolean))
    : null;
  const incomingNormalized = normalizeJokerSpendMergeBalances(incomingBalances);

  incomingTypes
    .filter((jokerType) => !allowedTypes || allowedTypes.has(jokerType))
    .forEach((jokerType) => {
      nextBalances[jokerType] = incomingNormalized[jokerType];
    });

  return nextBalances;
}

export function mergeJokerSpendMutationBalances(previousBalances, response, selectedJokerType = '') {
  const selectedInventoryType = normalizeJokerSpendMergeType(
    response?.jokerType || response?.joker_type || selectedJokerType,
  ) || normalizeJokerSpendMergeType(selectedJokerType);
  const payloadTypes = getJokerSpendBalancePayloadTypes(response, selectedInventoryType);
  let nextBalances = normalizeJokerSpendMergeBalances(previousBalances);

  nextBalances = mergeJokerBalancesByPayloadTypes(nextBalances, response?.balances, payloadTypes);
  nextBalances = mergeJokerBalancesByPayloadTypes(nextBalances, response?.items, payloadTypes);

  const balanceAfter = response?.balanceAfter
    ?? response?.balance_after
    ?? response?.updatedCount
    ?? response?.updated_count
    ?? response?.inventory?.quantity;
  if (selectedInventoryType && balanceAfter !== undefined && balanceAfter !== null) {
    nextBalances[selectedInventoryType] = normalizeJokerSpendMergeQuantity(balanceAfter);
  }

  return nextBalances;
}

export function runJokerSpendMergeMatrix() {
  const initial = {
    mistake_shield: 3,
    card_swap: 3,
    time_freeze: 3,
  };
  const scenarios = [
    {
      id: 'A_CARD_SWAP_SELECTED_ONLY',
      actual: mergeJokerSpendMutationBalances(initial, {
        jokerType: 'card_swap',
        updatedCount: 2,
        balancePayloadTypes: ['card_swap'],
      }, 'card_swap'),
      expected: { mistake_shield: 3, card_swap: 2, time_freeze: 3 },
    },
    {
      id: 'B_MISTAKE_SHIELD_SELECTED_ONLY',
      actual: mergeJokerSpendMutationBalances(initial, {
        jokerType: 'mistake_shield',
        updatedCount: 2,
        balancePayloadTypes: ['mistake_shield'],
      }, 'mistake_shield'),
      expected: { mistake_shield: 2, card_swap: 3, time_freeze: 3 },
    },
    {
      id: 'C_TIME_FREEZE_SELECTED_ONLY',
      actual: mergeJokerSpendMutationBalances(initial, {
        jokerType: 'time_freeze',
        updatedCount: 2,
        balancePayloadTypes: ['time_freeze'],
      }, 'time_freeze'),
      expected: { mistake_shield: 3, card_swap: 3, time_freeze: 2 },
    },
    {
      id: 'D_PARTIAL_CARD_SWAP_RESPONSE',
      actual: mergeJokerSpendMutationBalances(initial, {
        jokerType: 'card_swap',
        updatedCount: 2,
      }, 'card_swap'),
      expected: { mistake_shield: 3, card_swap: 2, time_freeze: 3 },
    },
    {
      id: 'E_MISSING_FIELDS_STAY_UNCHANGED',
      actual: mergeJokerSpendMutationBalances(initial, {
        jokerType: 'card_swap',
        balances: { card_swap: 2 },
        balancePayloadTypes: ['card_swap'],
      }, 'card_swap'),
      expected: { mistake_shield: 3, card_swap: 2, time_freeze: 3 },
    },
    {
      id: 'F_IDEMPOTENT_DUPLICATE_RESULT_DOES_NOT_DOUBLE_SPEND',
      actual: mergeJokerSpendMutationBalances(
        { mistake_shield: 3, card_swap: 2, time_freeze: 3 },
        {
          ok: true,
          alreadyApplied: true,
          jokerType: 'card_swap',
          balanceAfter: 2,
          balancePayloadTypes: ['card_swap'],
        },
        'card_swap',
      ),
      expected: { mistake_shield: 3, card_swap: 2, time_freeze: 3 },
    },
    {
      id: 'G_TUTORIAL_NO_SPEND_BASELINE_UNCHANGED',
      actual: mergeJokerSpendMutationBalances(initial, null, ''),
      expected: initial,
    },
    {
      id: 'H_UNDERPOPULATED_FULL_BALANCES_NO_COMPLETE_FLAG',
      actual: mergeJokerSpendMutationBalances(initial, {
        jokerType: 'card_swap',
        balanceAfter: 2,
        balances: { mistake_shield: 0, card_swap: 2, time_freeze: 0 },
      }, 'card_swap'),
      expected: { mistake_shield: 3, card_swap: 2, time_freeze: 3 },
    },
  ];

  return scenarios.map((scenario) => ({
    ...scenario,
    passed: JOKER_SPEND_MERGE_TYPES.every((jokerType) => (
      scenario.actual[jokerType] === scenario.expected[jokerType]
    )),
  }));
}
