import { createRestAPIClient } from "masto";
import { JSDOM } from "jsdom";
import axios from "axios";

/**
 * @typedef { import("masto").mastodon.v1.Status } Status
 *
 * @typedef { import("./typedef.mjs").Post } Post
 * @typedef { import("./typedef.mjs").Card } Card
 * @typedef { import("./typedef.mjs").Image } Image
 * @typedef { import("./typedef.mjs").Command } Command
 */

/**
 * @param { string } url
 */
const getImage = async (url) => {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  /** @type { ArrayBuffer } */
  const data = res.data;
  const encoding = res.headers.getContentType();
  return { url, data, encoding };
};

/**
 * @param { HTMLTemplateElement } template
 */
const toTextWithNewLines = (template) => {
  const brs = template.content.querySelectorAll("br");
  for (const br of brs) {
    br.insertAdjacentText("afterend", "\n");
  }
  const ps = template.content.querySelectorAll("p");
  for (const p of ps) {
    p.insertAdjacentText("afterend", "\n\n");
  }
  return template.content.textContent.trim();
};

/**
 * @param { HTMLAnchorElement} anchor
 * @returns { Command | null } command
 */
const findCommand = (anchor) => {
  if (anchor?.previousSibling?.nodeType === 3) {
    const commandText = anchor.previousSibling.textContent;
    if (commandText === "Reply ") {
      return { type: "Reply", postUrl: anchor.href };
    } else if (commandText === "Repost ") {
      return { type: "Repost", postUrl: anchor.href };
    } else if (commandText === "Quote ") {
      return { type: "Quote", postUrl: anchor.href };
    }
  }
  return null;
};

/**
 * @param { HTMLAnchorElement} anchor
 */
const removeCommand = (anchor) => {
  // remove command text
  anchor.previousSibling.remove();
  // remove <br />
  if (
    anchor.nextSibling?.nodeType === 1 &&
    anchor.nextElementSibling.tagName === "BR"
  ) {
    anchor.nextSibling.remove();
  }
  // remove <a>...</a>
  anchor.remove();
};

/**
 * @param { HTMLAnchorElement} anchor
 */
const findMention = (anchor) => {
  // mention e.g. <a href="https://bsky.app/profile/frieren.websunday.net">
  if (anchor?.href?.startsWith("https://bsky.app/profile/")) {
    const profile = anchor.href.substring(25);
    const lastSlash = profile.indexOf("/");
    if (lastSlash === -1) {
      return `@${profile}`;
    }
  }
  return null;
};

/**
 * @param { HTMLAnchorElement} anchor
 * @param { string } mention
 */
const replaceMention = (anchor, mention) => {
  anchor.insertAdjacentText("afterend", mention);
  anchor.remove();
};

/**
 * @param { HTMLTemplateElement } template
 */
const replaceTemplateContent = (template) => {
  /** @type { HTMLAnchorElement | undefined } */
  const anchor = template.content.querySelector("a[href^='https://bsky.app/']");
  const command = findCommand(anchor);
  const mention = findMention(anchor);
  if (command != null) {
    removeCommand(anchor);
  } else if (mention != null) {
    replaceMention(anchor, mention);
  }
  return { command, mention };
};

/**
 * @param { Status } status
 */
const createPost = async (status) => {
  /** @type { Post } */
  const post = {
    statusId: status.id,
    createdAt: status.createdAt,
  };

  const doc = new JSDOM().window.document;
  const template = doc.createElement("template");
  template.innerHTML = status.content;

  const { command, mention } = replaceTemplateContent(template);
  post.content = toTextWithNewLines(template);
  post.command = command;
  if (command == null && mention == null && status.card != null) {
    post.card = {
      url: status.card.url,
      title: status.card.title,
      description: status.card.description,
    };
    if (status.card.image != null) {
      post.card.image = await getImage(status.card.image);
      post.card.image.width = status.card.width;
      post.card.image.height = status.card.height;
    }
  }

  return post;
};

/**
 * @param { string } url
 * @param { string } accessToken
 */
export const mastodon = (url, accessToken) => {
  const masto = createRestAPIClient({
    url: url,
    accessToken: accessToken,
  });
  return {
    /**
     * @param { string } userId
     * @param { string } minStatusId
     */
    async *getPosts(userId, minStatusId) {
      const statuses = await masto.v1.accounts
        .$select(userId)
        .statuses.list({ minId: minStatusId });
      /** @type {Status[]} */
      const reversedStatuses = statuses.toReversed();
      for (const status of reversedStatuses) {
        if (status.reblog) {
          continue;
        }
        const post = await createPost(status);
        yield post;
      }
    },
  };
};
