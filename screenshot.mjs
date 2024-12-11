import axios from "axios";

/**
 * @param { string } endpoint 
 */
export const screenshot = (endpoint) => {
    return {
        /**
         * @param { string } url
         * @returns { Promise<ArrayBuffer | null> }
         */
        async capture(url) {
            let /** @type {URL} */urlObj;
            try {
                urlObj = new URL(url);
            } catch {
                return null;
            }
            const res = await axios.get(`${endpoint}?url=${urlObj}`, {
                responseType: "arraybuffer",
                headers: {
                    "Content-Type": "image/png"
                }
            });
            return res.data;
        }
    };
}
