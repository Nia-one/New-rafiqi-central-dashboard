"use client"

import type { ComponentType } from "react"
import {
  BadgeIndianRupee,
  BookOpen,
  BrainCircuit,
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  CircleUserRound,
  Gauge,
  HeartHandshake,
  House,
  Landmark,
  LogOut,
  PackageCheck,
  Settings,
  ShieldCheck,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  WalletCards,
  X,
} from "lucide-react"
import { type DashboardTab, type DashboardWorkspace } from "@/lib/dashboard-model"
import type { OperatingLens } from "@/components/lens"
import { SegmentedControl } from "@/components/operating-ui"

type NavigationItem = {
  label: string
  tab: DashboardTab
  icon: ComponentType<{ "aria-hidden"?: boolean }>
}

const OPERATING_LOOPS: readonly NavigationItem[] = [
  { label: "Cash & Control", tab: "Cash & Control", icon: Landmark },
  { label: "Enterprise Demand", tab: "Enterprise Demand", icon: Building2 },
  { label: "Member Adds", tab: "New Adds", icon: UserPlus },
  { label: "Member Engagement", tab: "Member Engagement", icon: HeartHandshake },
  { label: "Member Savings", tab: "Member Savings", icon: BadgeIndianRupee },
  { label: "Nia Margins", tab: "Nia Margins", icon: ChartNoAxesCombined },
  { label: "Nia Growth", tab: "Nia Growth", icon: TrendingUp },
]

const CONTINUITY: readonly NavigationItem[] = [
  { label: "Overview", tab: "Overview", icon: Gauge },
  { label: "Living", tab: "Living", icon: House },
  { label: "Work", tab: "Work", icon: WalletCards },
  { label: "Essentials", tab: "Essentials", icon: PackageCheck },
  { label: "Member NPS", tab: "Member Feedback", icon: HeartHandshake },
  { label: "People", tab: "People", icon: Users },
  { label: "Learning History", tab: "Definitions", icon: BookOpen },
]

const FINANCE: readonly NavigationItem[] = [
  { label: "Finance Control", tab: "Finance control", icon: Landmark },
  { label: "Nia Margins", tab: "Nia Margins", icon: ChartNoAxesCombined },
  { label: "Cash & Control", tab: "Cash & Control", icon: WalletCards },
]

const DESPATCH_ITEM: NavigationItem = { label: "Despatch", tab: "Despatch", icon: Truck }

function RailButton({ item, active, onClick }: { item: NavigationItem; active: DashboardTab | null; onClick: () => void }) {
  const Icon = item.icon
  return <button type="button" className={active === item.tab ? "active" : ""} aria-current={active === item.tab ? "page" : undefined} onClick={onClick}>
    <Icon aria-hidden />
    <span>{item.label}</span>
  </button>
}

export function CentralSidebar({
  active,
  workspace,
  lens = "operate",
  decisionRoomActive = false,
  financeAllowed,
  enterpriseAllowed,
  signOffAllowed,
  open,
  onClose,
  onWorkspace,
  onNavigate,
  onDecisionRoom,
  onLens,
  onSignOut,
}: {
  active: DashboardTab
  workspace: DashboardWorkspace
  lens?: OperatingLens
  decisionRoomActive?: boolean
  financeAllowed: boolean
  enterpriseAllowed: boolean
  signOffAllowed: boolean
  open: boolean
  onClose: () => void
  onWorkspace: (workspace: DashboardWorkspace) => void
  onNavigate: (workspace: DashboardWorkspace, tab: DashboardTab) => void
  onDecisionRoom?: () => void
  onLens?: (lens: OperatingLens) => void
  onSignOut: () => void
}) {
  const workspaceItems = workspace === "self-drive"
    ? OPERATING_LOOPS.filter((item) => item.tab !== "Enterprise Demand" || enterpriseAllowed)
    : workspace === "self-learn"
      ? CONTINUITY
      : FINANCE

  return <aside className={`central-rail ${open ? "open" : ""}`} aria-label="RafiQi Central navigation">
    <div className="rail-account">
      <span className="rail-mark">R</span>
      <div><strong>RafiQi Central</strong><small>Operating system</small></div>
      <ChevronDown aria-hidden />
      <button type="button" className="rail-close" aria-label="Close navigation" onClick={onClose}><X aria-hidden /></button>
    </div>

    {onLens ? <div className="rail-lens">
      <SegmentedControl label="Operating lens" value={lens} onChange={onLens} options={[{ value: "decide", label: "Decide" }, { value: "operate", label: "Operate" }]} />
    </div> : null}

    <nav className="rail-navigation">
      <p>Workspaces</p>
      <button type="button" className={workspace === "self-drive" ? "active" : ""} onClick={() => { onWorkspace("self-drive"); onClose() }}><Gauge aria-hidden /><span>Self Drive</span></button>
      <button type="button" className={workspace === "self-learn" ? "active" : ""} onClick={() => { onWorkspace("self-learn"); onClose() }}><BrainCircuit aria-hidden /><span>Self Learn</span></button>
      {financeAllowed ? <button type="button" className={workspace === "finance" ? "active" : ""} onClick={() => { onWorkspace("finance"); onClose() }}><Landmark aria-hidden /><span>Finance</span></button> : null}

      {workspace === "self-drive" && lens === "decide" && onDecisionRoom ? <>
        <p>Decide</p>
        <button type="button" className={decisionRoomActive ? "active" : ""} aria-current={decisionRoomActive ? "page" : undefined} onClick={() => { onDecisionRoom(); onClose() }}><Gauge aria-hidden /><span>Decision Room</span></button>
      </> : null}
      {workspace === "self-drive" && lens === "operate" ? <>
        <p>Operate</p>
        <RailButton item={DESPATCH_ITEM} active={active} onClick={() => { onNavigate("self-drive", "Despatch"); onClose() }} />
      </> : null}
      <p>{workspace === "self-drive" ? (lens === "operate" ? "Governed queues" : "Operating loops") : workspace === "self-learn" ? "Continuity" : "Finance"}</p>
      {workspaceItems.map((item) => <RailButton key={item.tab} item={item} active={decisionRoomActive ? null : active} onClick={() => { onNavigate(workspace, item.tab); onClose() }} />)}

      {workspace === "self-drive" ? <>
        <p>System</p>
        {signOffAllowed ? <RailButton item={{ label: "Your Sign-Off", tab: "Your Sign-Off", icon: ShieldCheck }} active={active} onClick={() => { onNavigate("self-drive", "Your Sign-Off"); onClose() }} /> : null}
        {lens === "decide" ? <RailButton item={DESPATCH_ITEM} active={decisionRoomActive ? null : active} onClick={() => { onNavigate("self-drive", "Despatch"); onClose() }} /> : null}
        <RailButton item={{ label: "Learning History", tab: "Definitions", icon: BookOpen }} active={active} onClick={() => { onNavigate("self-learn", "Definitions"); onClose() }} />
      </> : null}
    </nav>

    <div className="rail-footer">
      <div className="rail-status"><span />Data status</div>
      <button type="button"><Settings aria-hidden /><span>Account settings</span></button>
      <button type="button" className="rail-profile" onClick={onSignOut}><CircleUserRound aria-hidden /><span><strong>Nia operator</strong><small>Sign out</small></span><LogOut aria-hidden /></button>
    </div>
  </aside>
}
