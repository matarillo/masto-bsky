import process from "node:process";
import * as fs from "node:fs/promises";
import dotenv from "dotenv";
import { mastodon } from "./mastodon.mjs";
import { bluesky } from "./bluesky.mjs";

/** @typedef {{ id: string, error: string }} LastToot */

const dryRun = process.argv.includes("--dry-run");

const now = new Date();
console.log(now.toISOString());

const lastToot = await readLog();
console.log(`lastToot: ${lastToot.id}`);
if (lastToot.error != null) {
  console.log(`last error: ${lastToot.error}`);
  console.log();
  process.exit(1);
}

dotenv.config();

const mastodonClient = mastodon(
  process.env.MASTODON_URL,
  process.env.MASTODON_TOKEN
);
const blueskyClient = bluesky(
  process.env.BSKY_URL,
  process.env.BSKY_ID,
  process.env.BSKY_PASSWORD
);
const matarilloUserId = process.env.MASTODON_USER_ID;

for await (const post of mastodonClient.getPosts(
  matarilloUserId,
  lastToot.id
)) {
  console.log(`statusId=${post.statusId}`);
  console.log(`content=${post.content}`);
  if (!dryRun) {
    try {
      if (!blueskyClient.loggedIn) {
        await blueskyClient.login();
      }

      if (post?.command?.type === "Reply") {
        await blueskyClient.reply(post.command.postUrl, post.content);
      } else if (post?.command?.type === "Repost") {
        await blueskyClient.repost(post.command.postUrl);
      } else if (post?.command?.type === "Quote") {
        await blueskyClient.quote(post.command.postUrl, post.content);
      } else {
        await blueskyClient.post(post.content, post.card, post.attachments);
      }
    } catch (e) {
      await writeLog({ id: post.statusId, error: `${e}` });
      console.log(`error: ${e}`);
      console.log();
      process.exit(1);
    }

    await writeLog({ id: post.statusId, error: null });
  }
  console.log();
}

async function readLog() {
  const json = await fs.readFile("./last-toot.log", { encoding: "utf8" });
  const union = JSON.parse(json);
  /** @type { LastToot } */
  const lastToot =
    typeof union === "number" ? { id: union, error: null } : union;
  return lastToot;
}

/**
 * @param {LastToot} lastToot
 */
async function writeLog(lastToot) {
  const json = JSON.stringify(lastToot);
  await fs.writeFile("./last-toot.log", json, {
    encoding: "utf8",
    flush: true,
  });
}
