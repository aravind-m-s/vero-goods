#!/usr/bin/env node
/**
 * Finds — and optionally fixes — user accounts that share a login identifier.
 *
 *   node --env-file=.env scripts/dedupe-user-identifiers.mjs --field=phone
 *   node --env-file=.env scripts/dedupe-user-identifiers.mjs --field=phone --fix
 *
 * Email, phone and googleId each have to resolve to exactly one account, or
 * "sign in with this number" is ambiguous. Older records violate that: checkout
 * used to copy whatever phone number the shopper typed onto their user record
 * without verifying it, so two people could end up sharing one.
 *
 * `--fix` keeps the identifier on the strongest claim — verified first, then
 * the account that has orders, then the oldest — and unsets it everywhere else.
 * No account is deleted and no order is touched; the losing accounts simply
 * stop carrying a contact detail they never proved they own.
 */
import { MongoClient } from 'mongodb';

const args = process.argv.slice(2);
const field = (args.find((a) => a.startsWith('--field=')) ?? '--field=phone').split('=')[1];
const apply = args.includes('--fix');

if (!['email', 'phone', 'googleId'].includes(field)) {
  console.error('Usage: --field=email|phone|googleId [--fix]');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set. Run with: node --env-file=.env scripts/…');
  process.exit(1);
}

const verifiedFlag = field === 'phone' ? 'phoneVerified' : 'emailVerified';

const client = new MongoClient(uri, { family: 4 });
await client.connect();

try {
  const db = client.db();
  const users = db.collection('users');
  const orders = db.collection('orders');

  const groups = await users
    .aggregate([
      { $match: { [field]: { $type: 'string', $ne: '' } } },
      { $group: { _id: `$${field}`, ids: { $push: '$id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();

  if (groups.length === 0) {
    console.log(`No duplicate ${field} values. A unique index will build cleanly.`);
    process.exit(0);
  }

  console.log(`${groups.length} duplicated ${field} value(s):\n`);

  for (const group of groups) {
    const accounts = await users.find({ id: { $in: group.ids } }).toArray();

    const scored = await Promise.all(
      accounts.map(async (account) => ({
        account,
        verified: field === 'googleId' ? true : Boolean(account[verifiedFlag]),
        orderCount: await orders.countDocuments({ userId: account.id }),
      }))
    );

    scored.sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      if (a.orderCount !== b.orderCount) return b.orderCount - a.orderCount;
      return String(a.account.createdAt).localeCompare(String(b.account.createdAt));
    });

    const [keep, ...lose] = scored;
    console.log(`  ${field} = ${group._id}`);
    console.log(
      `    keep   ${keep.account.id} (${keep.account.name}) verified=${keep.verified} orders=${keep.orderCount}`
    );
    for (const entry of lose) {
      console.log(
        `    clear  ${entry.account.id} (${entry.account.name}) verified=${entry.verified} orders=${entry.orderCount}`
      );
    }

    if (apply) {
      await users.updateMany(
        { id: { $in: lose.map((entry) => entry.account.id) } },
        { $unset: { [field]: '' }, $set: { [verifiedFlag]: false } }
      );
    }
  }

  console.log(
    apply
      ? `\nDone. Restart the app so the unique index on users.${field} rebuilds.`
      : '\nDry run — nothing was written. Re-run with --fix to apply.'
  );
} finally {
  await client.close();
}
