"use client"

import { ControlTower } from "@/components/control-tower"
import { persistOperatingLens } from "@/components/lens"
import { NiaDashboard } from "@/components/nia-dashboard"
import type { DashboardTab } from "@/lib/dashboard-model"
import type { ComponentProps } from "react"
import { useState } from "react"

type DashboardProps = ComponentProps<typeof NiaDashboard>

const workspaceTabs: Record<string, DashboardTab> = {
  "Enterprise demand": "Enterprise Demand",
  "Member adds": "New Adds",
  "Member engagement": "Member Engagement",
  "Member savings": "Member Savings",
  "Living": "Living",
  "Living occupancy": "Living",
  "Collections": "Economics",
  "Nia margins": "Nia Margins",
  "Nia growth": "Nia Growth",
}

export function ControlTowerShell(props: DashboardProps) {
  const [activeWorkspace, setActiveWorkspace] = useState<DashboardTab | null>(null)

  if (activeWorkspace === null) {
    return (
      <ControlTower
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
    )
  }

  return <NiaDashboard {...props} initialActive={activeWorkspace} onControlTower={() => setActiveWorkspace(null)} />
}
