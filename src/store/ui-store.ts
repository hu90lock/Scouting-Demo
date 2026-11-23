import { create } from "zustand"

type UIState = { sidebarOpen: boolean; activeTab: string; setSidebarOpen: (open: boolean) => void; setActiveTab: (tab: string) => void }
export const useUIStore = create<UIState>((set) => ({ sidebarOpen: true, activeTab: "overview", setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }), setActiveTab: (activeTab) => set({ activeTab }) }))
