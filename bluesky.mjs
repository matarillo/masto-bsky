// import { BskyAgent, RichText } from "@atproto/api"; // commonjs
import atproto from "@atproto/api"; // commonjs

/**
 * @type {{
 *      BskyAgent: import("@atproto/api").BskyAgent,
 *      RichText: import("@atproto/api").RichText
 * }}
 */
const { BskyAgent, RichText } = atproto;

/**
 * @param { string } url 
 * @param { string } identifier 
 * @param { string } password 
 */
export const bluesky = (url, identifier, password) => {
    const agent = new BskyAgent({ service: url });
    let loggedIn = false;
    const ensureLogin = async () => {
        if (!loggedIn) {
            await agent.login({ identifier: identifier, password: password });
            loggedIn = true;
        }
    }
    const uploadBlob = async (/** @type { ArrayBuffer } */image) => {
        const res = await agent.uploadBlob(image, { encoding: "image/png" });
        const blob = res.data.blob;
        return {
            link: blob.ref.toString(),
            mimeType: blob.mimeType,
            size: blob.size
        };
    }
    const post = async ({ url, title, description, blob }) => {
        const embed = {
            $type: "app.bsky.embed.external",
            external: {
                uri: url,
                thumb: (blob) ? {
                    $type: "blob",
                    ref: {
                        $link: blob.ref,
                    },
                    mimeType: blob.mimeType,
                    size: blob.size,
                } : null,
                title: title,
                description: description
            },
        };
        const rt = new RichText({ text: "" });
        await rt.detectFacets(agent);
        await agent.post({
            text: rt.text,
            fasets: rt.facets,
            embed: embed,
        });
    }
    return {
        /**
         * @param {{ url: string, title: string, description: string, image?: ArrayBuffer | null }} 
         */
        async postLinkCard({ url, title, description, image }) {
            await ensureLogin();
            const blob = (image) ? await uploadBlob(image) : null;
            await post(title, url, description, blob);
        }
    };
}
