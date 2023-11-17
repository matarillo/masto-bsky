import * as fs from "node:fs/promises";
import dotenv from "dotenv";
import { mastodon } from "./mastodon.mjs";
import { screenshot } from "./screenshot.mjs";
import { bluesky } from "./bluesky.mjs";

const matarilloUserId = "1";

const now = new Date();
console.log(now.toISOString());

let lastTootId = (await fs.readFile("./last-toot.log", { encoding: "utf8" })).trim();
console.log(`lastToot: ${lastTootId}`);

dotenv.config();
const mastodonClient = mastodon(process.env.MASTODON_URL, process.env.MASTODON_TOKEN);
const screenshotClient = screenshot(process.env.SCREENSHOT_ENDPOINT);
const blueskyClient = bluesky(process.env.BSKY_URL, process.env.BSKY_ID, process.env.BSKY_PASSWORD);

for await (const status of mastodonClient.getStatuses(matarilloUserId, lastTootId)) {
    const image = await screenshotClient.capture(status.url);
    await blueskyClient.postLinkCard({ ...status, image });
    await fs.writeFile("./last-toot.log", status.id, { encoding: "utf8", flush: true });
    console.log(`id=${status.id}`);
    console.log(`url=${status.url}`);
    console.log(`title=${status.title}`);
    console.log(`description=${status.description}`);
    console.log();
}
