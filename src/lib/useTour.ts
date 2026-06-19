'use client'
import { driver, type DriveStep } from 'driver.js'

export interface TourDef { id: string; version: number; steps: DriveStep[] }

function seenKey(t: TourDef) { return `hsl_tour_${t.id}_v${t.version}` }

export function hasSeenTour(t: TourDef) {
  try { return localStorage.getItem(seenKey(t)) === '1' } catch { return false }
}

export function startTour(t: TourDef, opts?: { force?: boolean }) {
  if (!opts?.force && hasSeenTour(t)) return
  const d = driver({
    showProgress: true,
    nextBtnText: 'Lanjut',
    prevBtnText: 'Balik',
    doneBtnText: 'Selesai',
    steps: t.steps,
    onDestroyed: () => { try { localStorage.setItem(seenKey(t), '1') } catch {} },
  })
  // Hanya step yang anchor-nya ADA di DOM (biar gak nyangkut di element yang lagi gak ke-render)
  const valid = t.steps.filter(s => !s.element || document.querySelector(s.element as string))
  if (valid.length === 0) return
  d.setSteps(valid)
  d.drive()
}
