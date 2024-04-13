import atproto from "@atproto/api";

/**
 * @typedef { import("@atproto/api").BskyAgent } BskyAgent
 * @typedef { import("@atproto/api").RichText } RichText
 * @typedef { import("@atproto/api").BlobRef } BlobRef
 * @typedef { import("@atproto/api").AppBskyFeedPost.Record } Record
 * @typedef { import("@atproto/api").AppBskyEmbedExternal.External } EmbedExternal
 * @typedef { import("@atproto/api").ComAtprotoRepoStrongRef.Main } EmbedRecord
 * @typedef { import("@atproto/api").AppBskyFeedDefs } AppBskyFeedDefs
 * @typedef { import("@atproto/api").AppBskyFeedDefs.ThreadViewPost } ThreadViewPost
 *
 * @typedef { import("./typedef.mjs").Post } Post
 * @typedef { import("./typedef.mjs").Card } Card
 * @typedef { import("./typedef.mjs").Image } Image
 * @typedef { import("./typedef.mjs").Command } Command
 */

/**
 * @type {{
 *   BskyAgent: BskyAgent,
 *   RichText: RichText,
 *   BlobRef: BlobRef,
 *   AppBskyFeedDefs: AppBskyFeedDefs
 * }}
 */
const { BskyAgent, RichText, BlobRef, AppBskyFeedDefs } = atproto;

/**
 * @param { string } url
 * @param { string } identifier
 * @param { string } password
 */
export const bluesky = (url, identifier, password) => {
  /**
   * richText.detectFacets(agent) の中で、 agent.resolveHandle() が呼ばれる
   * @type { BskyAgent }
   */
  const agent = new BskyAgent({ service: url });

  /**
   * @param { string } text
   */
  const toRichText = async (text) => {
    /** @type { RichText } */
    const rt = new RichText({
      text: text,
    });
    await rt.detectFacets(agent);
    return rt;
  };

  /**
   * @param { ArrayBuffer } image
   * @param { string } encoding
   */
  const uploadBlob = async (image, encoding) => {
    const res = await agent.uploadBlob(image, { encoding: encoding });
    return res.data.blob;
  };

  /**
   * @param { string } httpsPostUrl
   */
  const getPost = async (httpsPostUrl) => {
    if (!(httpsPostUrl && httpsPostUrl.startsWith("https://"))) {
      return;
    }
    const urlParts = httpsPostUrl.substring(8).split("/");
    if (!(urlParts && urlParts.length === 5)) {
      return;
    }
    const [domain, profileLabel, profile, postLabel, keyOfPost] = urlParts;
    if (
      !(
        domain === "bsky.app" &&
        profileLabel === "profile" &&
        postLabel === "post"
      )
    ) {
      return;
    }
    const handleResponse = await agent.resolveHandle({ handle: profile });
    const didOfProfile = handleResponse.data.did;
    const post = await agent.getPost({
      repo: didOfProfile,
      rkey: keyOfPost,
    });
    return post;
  };

  /**
   * @param { string } atPostUri
   */
  const getReply = async (atPostUri) => {
    const res = await agent.getPostThread({ uri: atPostUri });
    const parentPost = res.data.thread;
    if (!AppBskyFeedDefs.isThreadViewPost(parentPost)) {
      return;
    }
    let rootPost = parentPost;
    while (AppBskyFeedDefs.isThreadViewPost(rootPost.parent)) {
      rootPost = rootPost.parent;
    }
    return {
      root: {
        uri: rootPost.uri,
        cid: rootPost.cid,
      },
      parent: {
        uri: parentPost.uri,
        cid: parentPost.cid,
      },
    };
  };

  /**
   * @param { { uri: string, cid: string} } post
   */
  const getEmbedRecord = (post) => {
    /** @type { EmbedRecord } */
    const record = {
      uri: post.uri,
      cid: post.cid,
    };
    return {
      $type: "app.bsky.embed.record",
      record: record,
    };
  };

  /**
   * @param { Card? } card
   */
  const getEmbedExternal = async (card) => {
    if (card == null) {
      return null;
    }
    /** @type { EmbedExternal } */
    const external = {
      uri: card.url,
      title: card.title,
      description: card.description,
    };
    if (card.image != null) {
      const blob = await uploadBlob(card.image.data, card.image.encoding);
      external.thumb = blob;
    }
    return {
      $type: "app.bsky.embed.external",
      external: external,
    };
  };

  return {
    async login() {
      await agent.login({ identifier: identifier, password: password });
    },

    /**
     * @param { string } httpsPostUrl
     */
    async repost(httpsPostUrl) {
      const post = await getPost(httpsPostUrl);
      if (post == null) {
        console.log(`TRACE: bsky post ${httpsPostUrl} to repost is not found.`)
        return;
      }
      return await agent.repost(post.uri, post.cid);
    },

    /**
     * @param { string } httpsPostUrl
     * @param { string } textContent
     */
    async reply(httpsPostUrl, textContent) {
      const post = await getPost(httpsPostUrl);
      if (post == null) {
        console.log(`TRACE: bsky post ${httpsPostUrl} to reply is not found.`)
        return;
      }
      const reply = await getReply(post.uri);
      if (reply == null) {
        console.log(`TRACE: bsky thread about ${post.uri} is not found.`)
        return;
      }
      const rt = await toRichText(textContent);
      return await agent.post({
        text: rt.text,
        facets: rt.facets,
        reply: reply,
      });
    },

    /**
     * @param { string } httpsPostUrl
     * @param { string } textContent
     * @returns Post
     */
    async quote(httpsPostUrl, textContent) {
      const post = await getPost(httpsPostUrl);
      if (post == null) {
        console.log(`TRACE: bsky post ${httpsPostUrl} to quote is not found.`)
        return;
      }
      const rt = await toRichText(textContent);
      return await agent.post({
        text: rt.text,
        facets: rt.facets,
        embed: getEmbedRecord(post),
      });
    },

    /**
     * @param { string } textContent
     * @param { Card? } card
     */
    async post(textContent, card) {
      const rt = await toRichText(textContent);

      /** @type { Record } */
      const record = {
        text: rt.text,
        facets: rt.facets,
      };
      const embed = await getEmbedExternal(card);
      if (embed) {
        record.embed = embed;
      }
      return await agent.post(record);
    },
  };
};
