export function exclude<
  Data extends Record<string, unknown>,
  Key extends keyof Data,
>(data: Data, keys: Key[]): Omit<Data, Key> {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !keys.includes(key as Key)),
  ) as Omit<Data, Key>;
}
