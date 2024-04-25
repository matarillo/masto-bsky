/**
 * @typedef { Object } Post
 * @property { string } statusId
 * @property { string } createdAt
 * @property { string } content
 * @property { Card? } card
 * @property { Command? } command
 * @property { Image[]? } attachments
 * 
 * @typedef { Object } Card
 * @property { string } url
 * @property { string } title
 * @property { string } description
 * @property { string } providerName
 * @property { Image } image
 * 
 * @typedef { Object } Image
 * @property { string } url
 * @property { number } width
 * @property { number } height
 * @property { ArrayBuffer } data
 * @property { string } contentType
 * 
 * @typedef { Object } Command
 * @property { "Reply" | "Repost" | "Quote" } type
 * @property { string } postUrl
 */
