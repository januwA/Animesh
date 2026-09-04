import { create } from "zustand";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type AutoSetters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (val: T[K]) => void;
};

export type AnimeStoreState<T> = T & AutoSetters<T> & { reset: () => void };

/**
 * 创建通用 anime store，自动为每个字段生成 setX 方法和 reset 方法。
 * 需要自定义 action（如 appendResults）的 store 不适用此工厂。
 */
export function createAnimeStore<T extends object>(initialState: T) {
  return create<AnimeStoreState<T>>()((set) => {
    const actions = {} as AutoSetters<T>;
    for (const key of Object.keys(initialState)) {
      const prop = key as keyof T;
      const setterName = `set${capitalize(key)}` as keyof AutoSetters<T>;
      (actions as Record<string, unknown>)[setterName as string] = (
        val: unknown,
      ) => set({ [prop]: val } as Partial<AnimeStoreState<T>>);
    }

    return {
      ...initialState,
      ...actions,
      reset: () => set(initialState as AnimeStoreState<T>),
    } as AnimeStoreState<T>;
  });
}
