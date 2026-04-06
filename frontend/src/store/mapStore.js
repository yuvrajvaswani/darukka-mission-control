import { create } from 'zustand'

export const useMapStore = create((set, get) => ({
  // Sites loaded for the current project
  sites: [],
  setSites: (sites) => set({ sites }),
  addSite: (site) => set((s) => ({ sites: [...s.sites, site] })),
  removeSite: (id) => set((s) => ({ sites: s.sites.filter((x) => x.id !== id) })),
  updateSite: (id, patch) =>
    set((s) => ({
      sites: s.sites.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    })),

  // Currently selected site (for the insight panel)
  selectedSiteId: null,
  setSelectedSiteId: (id) => set({ selectedSiteId: id }),
  selectedSite: () => {
    const { sites, selectedSiteId } = get()
    return sites.find((s) => s.id === selectedSiteId) ?? null
  },

  // Draw mode
  drawMode: 'idle', // 'idle' | 'drawing' | 'saving'
  setDrawMode: (mode) => set({ drawMode: mode }),

  // Pending polygon (drawn but not yet saved)
  pendingGeometry: null,
  setPendingGeometry: (geo) => set({ pendingGeometry: geo, drawMode: 'saving' }),
  clearPending: () => set({ pendingGeometry: null, drawMode: 'idle' }),

  // Timeline (shared across map + charts)
  timelineDate: null,
  setTimelineDate: (date) => set({ timelineDate: date }),
}))
