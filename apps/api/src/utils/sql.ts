export const escapeLikeLiteral = (str: string) => {
  return str.replace(/[\\%_]/g, "\\$&");
};
