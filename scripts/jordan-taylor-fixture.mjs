const dayMs = 86_400_000;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(today, days) {
  const date = new Date(`${today}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

/**
 * A branch-neutral v2 snapshot used for the Jordan Taylor usability study.
 * It intentionally omits the five participant tasks. Keep IDs stable so reset
 * is deterministic while dates remain believable whenever it is run.
 */
export function buildJordanTaylorSnapshot(userId, today = isoDate(new Date())) {
  const date = (days) => shiftDate(today, days);
  const checking = 'jordan:checking';
  const savings = 'jordan:savings';
  const category = (name) => `jordan:category:${name.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  const paycheck = (number) => `jordan:paycheck:${number}`;
  const allocation = (number, name) => `jordan:allocation:${number}:${name}`;

  const categories = ['Rent', 'Utilities', 'Groceries', 'Gas', 'Phone', 'Subscriptions', 'Dining/Coffee', 'Clothing', 'Savings']
    .map(name => ({ id: category(name), name }));
  const categoryId = Object.fromEntries(categories.map(item => [item.name, item.id]));

  const paychecks = [
    { number: 1, amountCents: 72_000, daysAgo: -70 },
    { number: 2, amountCents: 84_000, daysAgo: -56 },
    { number: 3, amountCents: 68_000, daysAgo: -42 },
    { number: 4, amountCents: 93_000, daysAgo: -28 },
    { number: 5, amountCents: 78_000, daysAgo: -14 },
  ].map(({ number, amountCents, daysAgo }) => ({
    id: paycheck(number), amountCents, receivedAt: date(daysAgo), status: 'received',
    source: 'Campus Bookstore', notes: 'Part-time student job', accountId: checking,
    accountCreditCents: amountCents, remainingAccountId: checking,
    budgetArchived: number < 5,
  }));

  // Each historic plan is at or below its associated variable paycheck.
  const allocationPlans = [
    [['Rent', 30_000], ['Utilities', 4_500], ['Groceries', 9_000], ['Gas', 5_000], ['Phone', 3_000], ['Subscriptions', 1_500], ['Dining/Coffee', 2_000], ['Clothing', 2_000], ['Savings', 8_000]],
    [['Rent', 30_000], ['Utilities', 5_000], ['Groceries', 10_000], ['Gas', 5_500], ['Phone', 3_000], ['Subscriptions', 1_500], ['Dining/Coffee', 3_000], ['Clothing', 3_000], ['Savings', 10_000]],
    [['Rent', 28_000], ['Utilities', 4_500], ['Groceries', 9_000], ['Gas', 5_000], ['Phone', 3_000], ['Subscriptions', 1_500], ['Dining/Coffee', 2_000], ['Clothing', 2_000], ['Savings', 7_000]],
    [['Rent', 32_000], ['Utilities', 5_000], ['Groceries', 11_000], ['Gas', 6_000], ['Phone', 3_000], ['Subscriptions', 1_500], ['Dining/Coffee', 3_000], ['Clothing', 3_000], ['Savings', 12_000]],
    [['Rent', 30_000], ['Utilities', 5_000], ['Groceries', 10_000], ['Gas', 6_000], ['Phone', 3_000], ['Subscriptions', 1_500], ['Dining/Coffee', 2_500], ['Clothing', 2_500], ['Savings', 10_000]],
  ];
  const allocations = allocationPlans.flatMap((plan, index) => plan.map(([name, amountCents]) => ({
    id: allocation(index + 1, name.toLowerCase().replace(/[^a-z]+/g, '-')), paycheckId: paycheck(index + 1),
    categoryId: categoryId[name], amountCents,
  })));
  const allocationId = (number, name) => allocation(number, name.toLowerCase().replace(/[^a-z]+/g, '-'));

  return {
    version: 2,
    user: { id: userId, displayName: 'Jordan Taylor', paydayFrequency: 'biweekly', nextPayday: date(1) },
    accounts: [
      { id: checking, name: 'Everyday Checking', type: 'checking', initialBalanceCents: 30_000 },
      { id: savings, name: 'Rainy Day Savings', type: 'high_yield_savings', initialBalanceCents: 65_000, interestRatePercent: 3.5, interestStartDate: date(-90), interestRateHistory: [{ effectiveDate: date(-90), ratePercent: 3.5 }] },
    ],
    categories,
    paychecks,
    allocations,
    transactions: [
      { id: 'jordan:transaction:rent-1', description: 'Campus Apartment Rent', amountCents: 65_000, date: date(-59), type: 'expense', categoryId: categoryId.Rent, allocationId: allocationId(2, 'rent'), accountId: checking },
      { id: 'jordan:transaction:electric', description: 'Electric utility', amountCents: 9_000, date: date(-49), type: 'expense', categoryId: categoryId.Utilities, allocationId: allocationId(3, 'utilities'), accountId: checking },
      { id: 'jordan:transaction:grocery-1', description: 'Fresh Market groceries', amountCents: 4_200, date: date(-38), type: 'expense', categoryId: categoryId.Groceries, allocationId: allocationId(3, 'groceries'), accountId: checking },
      { id: 'jordan:transaction:gas-1', description: 'Shell gas', amountCents: 2_800, date: date(-34), type: 'expense', categoryId: categoryId.Gas, allocationId: allocationId(3, 'gas'), accountId: checking },
      { id: 'jordan:transaction:phone-1', description: 'Phone bill', amountCents: 5_500, date: date(-30), type: 'expense', categoryId: categoryId.Phone, allocationId: allocationId(4, 'phone'), accountId: checking },
      { id: 'jordan:transaction:rent-2', description: 'Campus Apartment Rent', amountCents: 65_000, date: date(-28), type: 'expense', categoryId: categoryId.Rent, allocationId: allocationId(4, 'rent'), accountId: checking },
      { id: 'jordan:transaction:grocery-2', description: 'Fresh Market groceries', amountCents: 5_100, date: date(-20), type: 'expense', categoryId: categoryId.Groceries, allocationId: allocationId(4, 'groceries'), accountId: checking },
      { id: 'jordan:transaction:coffee', description: 'Coffee with classmates', amountCents: 1_800, date: date(-18), type: 'expense', categoryId: categoryId['Dining/Coffee'], allocationId: allocationId(4, 'dining-coffee'), accountId: checking },
      { id: 'jordan:transaction:gas-2', description: 'Shell gas', amountCents: 3_200, date: date(-12), type: 'expense', categoryId: categoryId.Gas, allocationId: allocationId(5, 'gas'), accountId: checking },
      { id: 'jordan:transaction:phone-2', description: 'Phone bill', amountCents: 5_500, date: date(-8), type: 'expense', categoryId: categoryId.Phone, allocationId: allocationId(5, 'phone'), accountId: checking },
      { id: 'jordan:transaction:clothing', description: 'Thrift store jacket', amountCents: 4_600, date: date(-6), type: 'expense', categoryId: categoryId.Clothing, allocationId: allocationId(5, 'clothing'), accountId: checking },
      { id: 'jordan:subscription:streaming', description: 'StreamFlix', amountCents: 1_500, date: date(-20), type: 'subscription', categoryId: categoryId.Subscriptions, accountId: checking, subscriptionFrequency: 'monthly', nextDueDate: date(4), notes: 'Upcoming $15 streaming charge — plan this from the next paycheck.' },
    ],
    goals: [],
    contributions: [],
  };
}

export function verifyJordanTaylorStartingData(data) {
  const fail = (message) => { throw new Error(`Jordan study fixture failed validation: ${message}`); };
  if (data.version !== 2 || data.user.displayName !== 'Jordan Taylor') fail('wrong user snapshot');
  if (data.paychecks.length !== 5 || data.paychecks.some(item => item.status !== 'received')) fail('expected five received historical paychecks');
  if (data.paychecks.some(item => item.amountCents === 85_000)) fail('the participant paycheck is preloaded');
  const required = ['Rent', 'Utilities', 'Groceries', 'Gas', 'Phone', 'Subscriptions', 'Dining/Coffee', 'Clothing', 'Savings'];
  if (required.some(name => !data.categories.some(category => category.name === name))) fail('required categories are missing');
  if (data.categories.some(category => category.name === 'Friend Outings')) fail('Friend Outings is preloaded');
  if (data.goals.some(goal => goal.name === 'Moving Fund' || goal.initialSavedCents === 30_000)) fail('Moving Fund or parent cash is preloaded');
  if (data.transactions.some(tx => tx.amountCents === 2_800 && /grocery/i.test(tx.description))) fail('the participant grocery purchase is preloaded');
  const stream = data.transactions.find(tx => tx.id === 'jordan:subscription:streaming');
  if (!stream || stream.amountCents !== 1_500 || stream.type !== 'subscription') fail('streaming reminder is missing');
  for (const paycheck of data.paychecks) {
    const allocated = data.allocations.filter(item => item.paycheckId === paycheck.id).reduce((sum, item) => sum + item.amountCents, 0);
    if (allocated > paycheck.amountCents) fail(`historic allocations exceed ${paycheck.id}`);
  }
  return true;
}
