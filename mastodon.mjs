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
 * @param { {image: string, width: number, height: number} } image
 * @returns { Promise<Image> } image
 */
const getImage = async (image) => {
  const res = await axios.get(image.image, { responseType: "arraybuffer" });
  /** @type { ArrayBuffer } */
  const data = res.data;
  /** @type { string } */
  const contentType = res.headers.getContentType();
  return { url: image.image, data, contentType: contentType, width: image.width, height: image.height };
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
    if (status.card?.image != null) {
      post.card.image = await getImage(status.card);
    }
  }
  if (status.mediaAttachments != null) {
    console.log(`TRACE: mastodon mediaAttachments.length=${status.mediaAttachments.length}`)
    const attachments = status.mediaAttachments.filter(x => x.type === "image");
    if (attachments.length > 0) {
      post.attachments = [];
      for (const attachment of attachments) {
        post.attachments.push(await getImage({
          image: attachment.previewUrl,
          width: attachment.meta.small.width,
          height: attachment.meta.small.height
        }));
      }
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
      console.log(`TRACE: mastodon statuses.length=${statuses.length}`)
      /** @type {Status[]} */
      const reversedStatuses = statuses.toReversed();
      for (const status of reversedStatuses) {
        if (status.reblog) {
          console.log(`TRACE: mastodon status ${status.id} is a reblog. skipping.`)
          continue;
        }
        const post = await createPost(status);
        console.log(`TRACE: mastodon status ${status.id} is a ${post?.command?.type ?? 'Plain Post'}`)
        yield post;
      }
    },
  };
};
