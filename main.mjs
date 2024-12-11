import process from "node:process";
import * as fs from "node:fs/promises";
import dotenv from "dotenv";
import { mastodon } from "./mastodon.mjs";
import { bluesky } from "./bluesky.mjs";

const dryRun = process.argv.includes("--dry-run");
const matarilloUserId = "1";

const now = new Date();
console.log(now.toISOString());

let lastTootId = (
  await fs.readFile("./last-toot.log", { encoding: "utf8" })
).trim();
console.log(`lastToot: ${lastTootId}`);

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
if (!dryRun) {
  await blueskyClient.login();
}

for await (const post of mastodonClient.getPosts(matarilloUserId, lastTootId)) {
  if (!dryRun) {
    try {
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
      console.log(`bluesky error: ${e}`);
      throw e;
    }

    await fs.writeFile("./last-toot.log", post.statusId, {
      encoding: "utf8",
      flush: true,
    });
  }
  console.log(`statusId=${post.statusId}`);
  console.log(`content=${post.content}`);
  console.log();
}
