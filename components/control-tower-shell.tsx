"use client"

import { ControlTower } from "@/components/control-tower"
import { persistOperatingLens } from "@/components/lens"
import { NiaDashboard } from "@/components/nia-dashboard"
import { GlobalLiveSync } from "@/components/global-live-sync"
import type { DashboardTab } from "@/lib/dashboard-model"
import type { ComponentProps } from "react"
import { useEffect, useState } from "react"

const ACTIVE_WORKSPACE_KEY = "rafiqi-active-workspace"

type DashboardProps = ComponentProps<typeof NiaDashboard>

const workspaceTabs: Record<string, DashboardTab> = {
  "Enterprise demand": "Enterprise Demand",
  "Member adds": "New Adds",
  "Member engagement": "Member Engagement",
  "Member savings": "Member Savings",
  "Living": "Living",
  "Living occupancy": "Living",
  "Nia growth": "Nia Growth",
  "Essentials": "Essentials",
}

export function ControlTowerShell(props: DashboardProps) {
  const [activeWorkspace, setActiveWorkspace] = useState<DashboardTab | null>(null)

  useEffect(() => {
    const stored = window.sessionStorage.getItem(ACTIVE_WORKSPACE_KEY) as DashboardTab | null
    if (stored) setActiveWorkspace(stored)
  }, [])

  useEffect(() => {
    if (activeWorkspace === null) window.sessionStorage.removeItem(ACTIVE_WORKSPACE_KEY)
    else window.sessionStorage.setItem(ACTIVE_WORKSPACE_KEY, activeWorkspace)
  }, [activeWorkspace])

  const workspace = activeWorkspace === null
    ? <ControlTower
        liveOpsData={props.liveOpsData}
        enterpriseDemandPreview={props.enterpriseDemandPreview!}
        controlledAutonomyPreview={props.controlledAutonomyPreview!}
        niaMarginsPreview={props.niaMarginsPreview}
        newAddsPreview={props.newAddsPreview}
        memberEngagementPreview={props.memberEngagementPreview ?? null}
        memberSavingsPreview={props.memberSavingsPreview}
        niaGrowthPreview={props.niaGrowthPreview}
        onOpenWorkspace={(workspace) => {
          // A Control Tower workspace launch always enters the operating surface,
          // regardless of the lens used during the previous dashboard visit.
          persistOperatingLens("operate")
          setActiveWorkspace(workspaceTabs[workspace] ?? "Despatch")
        }}
      />
    : <NiaDashboard {...props} initialActive={activeWorkspace} restoreStoredPage={false} onControlTower={() => setActiveWorkspace(null)} />

  return <><GlobalLiveSync />{workspace}</>
}
