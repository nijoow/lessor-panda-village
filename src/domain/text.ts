/** Match PostgreSQL char_length: count Unicode code points, not UTF-16 units. */
export const textLength = (text: string) => Array.from(text).length;
export const truncateText = (text: string, limit: number) =>
  Array.from(text).slice(0, limit).join("");
