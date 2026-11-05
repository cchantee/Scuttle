const iso = (date) => date.toISOString().slice(0, 10);
const shift = (today, offset) => { const date = new Date(`${today}T12:00:00.000Z`); date.setUTCDate(date.getUTCDate() + offset); return iso(date); };

/** Branch-neutral, resettable v2 data for the Jordan Taylor usability study. */
export function buildJordanTaylorSnapshot(userId, today = iso(new Date())) {
  const date = (offset) => shift(today, offset);
  const checking = 'jordan:checking', savings = 'jordan:savings';
  const names = ['Rent', 'Utilities', 'Groceries', 'Gas', 'Phone', 'Subscriptions', 'Dining/Coffee', 'Clothing', 'Savings'];
  const id = (name) => `jordan:category:${name.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  const categories = names.map(name => ({ id: id(name), name }));
  const category = Object.fromEntries(categories.map(row => [row.name, row.id]));
  const pay = (number) => `jordan:paycheck:${number}`;
  const allocationId = (number, name) => `jordan:allocation:${number}:${name.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  const paycheckInfo = [[72_000, -70], [84_000, -56], [68_000, -42], [93_000, -28], [78_000, -14]];
  const paychecks = paycheckInfo.map(([amountCents, offset], index) => ({ id: pay(index + 1), amountCents, receivedAt: date(offset), status: 'received', source: 'Campus Bookstore', notes: 'Part-time student job', accountId: checking, accountCreditCents: amountCents, remainingAccountId: checking, budgetArchived: index < 4 }));
  const plans = [
    [['Rent', 30_000], ['Utilities', 4_500], ['Groceries', 9_000], ['Gas', 5_000], ['Phone', 3_000], ['Subscriptions', 1_500], ['Dining/Coffee', 2_000], ['Clothing', 2_000], ['Savings', 8_000]],
    [['Rent', 30_000], ['Utilities', 5_000], ['Groceries', 10_000], ['Gas', 5_500], ['Phone', 3_000], ['Subscriptions', 1_500], ['Dining/Coffee', 3_000], ['Clothing', 3_000], ['Savings', 10_000]],
    [['Rent', 28_000], ['Utilities', 4_500], ['Groceries', 9_000], ['Gas', 5_000], ['Phone', 3_000], ['Subscriptions', 1_500], ['Dining/Coffee', 2_000], ['Clothing', 2_000], ['Savings', 7_000]],
    [['Rent', 32_000], ['Utilities', 5_000], ['Groceries', 11_000], ['Gas', 6_000], ['Phone', 3_000], ['Subscriptions', 1_500], ['Dining/Coffee', 3_000], ['Clothing', 3_000], ['Savings', 12_000]],
    [['Rent', 30_000], ['Utilities', 5_000], ['Groceries', 10_000], ['Gas', 6_000], ['Phone', 3_000], ['Subscriptions', 1_500], ['Dining/Coffee', 2_500], ['Clothing', 2_500], ['Savings', 10_000]],
  ];
  const allocations = plans.flatMap((plan, index) => plan.map(([name, amountCents]) => ({ id: allocationId(index + 1, name), paycheckId: pay(index + 1), categoryId: category[name], amountCents })));
  const expense = (key, description, amountCents, offset, name, paycheckNumber) => ({ id: `jordan:transaction:${key}`, description, amountCents, date: date(offset), type: 'expense', categoryId: category[name], allocationId: allocationId(paycheckNumber, name), accountId: checking });
  return { version: 2, user: { id: userId, displayName: 'Jordan Taylor', paydayFrequency: 'biweekly', nextPayday: date(1) },
    accounts: [{ id: checking, name: 'Everyday Checking', type: 'checking', initialBalanceCents: 30_000 }, { id: savings, name: 'Rainy Day Savings', type: 'high_yield_savings', initialBalanceCents: 65_000, interestRatePercent: 3.5, interestStartDate: date(-90), interestRateHistory: [{ effectiveDate: date(-90), ratePercent: 3.5 }] }],
    categories, paychecks, allocations,
    transactions: [
      expense('rent-1', 'Campus Apartment Rent', 65_000, -59, 'Rent', 2), expense('electric', 'Electric utility', 9_000, -49, 'Utilities', 3), expense('grocery-1', 'Fresh Market groceries', 4_200, -38, 'Groceries', 3), expense('gas-1', 'Shell gas', 2_800, -34, 'Gas', 3), expense('phone-1', 'Phone bill', 5_500, -30, 'Phone', 4), expense('rent-2', 'Campus Apartment Rent', 65_000, -28, 'Rent', 4), expense('grocery-2', 'Fresh Market groceries', 5_100, -20, 'Groceries', 4), expense('coffee', 'Coffee with classmates', 1_800, -18, 'Dining/Coffee', 4), expense('gas-2', 'Shell gas', 3_200, -12, 'Gas', 5), expense('phone-2', 'Phone bill', 5_500, -8, 'Phone', 5), expense('clothing', 'Thrift store jacket', 4_600, -6, 'Clothing', 5),
      { id: 'jordan:subscription:streaming', description: 'StreamFlix', amountCents: 1_500, date: date(-20), type: 'subscription', categoryId: category.Subscriptions, accountId: checking, subscriptionFrequency: 'monthly', nextDueDate: date(4), notes: 'Upcoming $15 streaming charge — plan this from the next paycheck.' },
    ], goals: [], contributions: [] };
}

export function verifyJordanTaylorStartingData(data) {
  const fail = (message) => { throw new Error(`Jordan study fixture failed validation: ${message}`); };
  if (data.version !== 2 || data.user.displayName !== 'Jordan Taylor') fail('wrong user snapshot');
  if (data.paychecks.length !== 5 || data.paychecks.some(item => item.status !== 'received')) fail('expected five received historical paychecks');
  if (data.paychecks.some(item => item.amountCents === 85_000)) fail('participant paycheck is preloaded');
  if (['Rent', 'Utilities', 'Groceries', 'Gas', 'Phone', 'Subscriptions', 'Dining/Coffee', 'Clothing', 'Savings'].some(name => !data.categories.some(item => item.name === name))) fail('required categories missing');
  if (data.categories.some(item => item.name === 'Friend Outings') || data.goals.some(item => item.name === 'Moving Fund' || item.initialSavedCents === 30_000)) fail('participant task data is preloaded');
  if (data.transactions.some(item => item.amountCents === 2_800 && /grocery/i.test(item.description))) fail('participant grocery purchase is preloaded');
  if (!data.transactions.some(item => item.id === 'jordan:subscription:streaming' && item.amountCents === 1_500 && item.type === 'subscription')) fail('streaming reminder missing');
  for (const paycheck of data.paychecks) if (data.allocations.filter(item => item.paycheckId === paycheck.id).reduce((sum, item) => sum + item.amountCents, 0) > paycheck.amountCents) fail(`historic allocations exceed ${paycheck.id}`);
  return true;
}
