import { createRestAPIClient } from "masto";
import { JSDOM } from "jsdom";

const formatAccount = (/** @type { string } */accountUrl) => {
    const u = new URL(accountUrl);
    const host = u.hostname;
    const id = u.pathname.substring(1);
    return `${id}@${host}`;
}

const doc = (new JSDOM()).window.document;
const template = doc.createElement("template");
const toTextContent = (/** @type { string } */htmlFragmrnt) => {
    template.innerHTML = htmlFragmrnt.replace(/<br \/>/g, "\n").replace(/<\/p><p>/g, "\n\n");
    return template.content.textContent;
}

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
        async *getStatuses(userId, minStatusId) {
            const statuses = await masto.v1.accounts.$select(userId).statuses.list({ minId: minStatusId });
            for (const status of statuses.reverse()) {
                if (status.reblog) {
                    continue;
                }
                const id = status.id;
                const url = status.url;
                const title = `${status.account.displayName} (${formatAccount(status.account.url)})`;
                const description = toTextContent(status.content);
                yield {
                    id: id,
                    url: url,
                    title: title,
                    description: description
                };
            }
        }
    }
}