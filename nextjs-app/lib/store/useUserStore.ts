"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type UserState = {
  userName: string | null;
  userColor: string | null;
  userIcon: string | null;
  setUser: (name: string, color: string, icon: string) => void;
  clearUser: () => void;
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      userName: null,
      userColor: null,
      userIcon: null,
      setUser: (name, color, icon) =>
        set({ userName: name, userColor: color, userIcon: icon }),
      clearUser: () =>
        set({ userName: null, userColor: null, userIcon: null }),
    }),
    {
      name: "climbing-user-storage",
    }
  )
);
