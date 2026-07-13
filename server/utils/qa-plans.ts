import type { getDb } from '~/server/database'

type PlanWithCases = NonNullable<Awaited<ReturnType<ReturnType<typeof getDb>['query']['qaPlans']['findFirst']>>> & {
  planCases?: Array<{
    sortOrder: number
    case: { id: string } | null
  }>
}

export function formatQaPlan(plan: PlanWithCases) {
  const { planCases, ...rest } = plan
  return {
    ...rest,
    cases: (planCases || []).map((pc) => pc.case).filter(Boolean),
    _caseCount: planCases?.length || 0,
  }
}
