import type { MemberSavingsShadowOutcome, SavingsTaskPreview } from "@/lib/operating-loop/member-savings-loop"

export function synchronizeMemberSavingsTaskState(currentTasks: readonly SavingsTaskPreview[], nextTasks: readonly SavingsTaskPreview[], currentSelection: Record<string, MemberSavingsShadowOutcome>) {
  const nextSelection = Object.fromEntries(nextTasks.map((task) => [task.actionId, currentSelection[task.actionId] ?? "Unresolved"])) as Record<string, MemberSavingsShadowOutcome>
  const currentById = new Map(currentTasks.map((task) => [task.actionId, task]))
  const mergedTasks = nextTasks.map((task) => {
    const currentTask = currentById.get(task.actionId)
    if (!currentTask) return task
    return Object.freeze({
      ...task,
      state: currentTask.state,
      progress: currentTask.progress,
      verifiedResult: currentTask.verifiedResult,
      engineAction: currentTask.engineAction,
    }) as SavingsTaskPreview
  })
  return { tasks: Object.freeze(mergedTasks), selected: nextSelection }
}

export function resolveMemberSavingsAskDueAt(tasks: readonly SavingsTaskPreview[], fallbackDueAt?: string, isLive = false) {
  if (isLive && tasks.length === 0) return null
  return tasks[0]?.dueAt || fallbackDueAt || ""
}
