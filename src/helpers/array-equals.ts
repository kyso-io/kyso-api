export const arrayEquals = (a: any[], b: any[]): boolean => {
  const aIsArray: boolean = Array.isArray(a);
  const bIsArray: boolean = Array.isArray(b);
  if (aIsArray !== bIsArray) {
    return false;
  }
  if (!aIsArray && !bIsArray) {
    return false;
  }
  return a.length === b.length && a.every((val: any, index: number) => val === b[index]);
};
