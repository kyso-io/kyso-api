export const arrayEquals = (a: any[], b: any[]): boolean => {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((val: any, index: number) => val === b[index]);
};
