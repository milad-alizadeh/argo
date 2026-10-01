// A vendor answer as recorded: the vendor's declared type, plus any field its declarations omit.
export type Recorded<T> = T extends (...parameters: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? Recorded<Item>[]
    : T extends object
      ? { [Key in keyof T]: Recorded<T[Key]> } & { [field: string]: unknown }
      : T
