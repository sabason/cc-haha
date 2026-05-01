/**
 * Combo Resolver — OmniRoute combination model routing
 *
 * Resolves combo models based on strategy (priority, round-robin, random,
 * weighted, least-used, cost-optimized, auto). When a provider has combos
 * configured, this service selects which actual model to route the request to.
 *
 * The resolved model name is then sent to the upstream OmniRoute server,
 * which handles the actual request dispatch and fallback.
 */

import type { Combo, ComboModelEntry, ComboStrategy } from '../types/provider.js'

interface NormalizedModelEntry {
  model: string
  weight: number
  label?: string
  providerId?: string
}

const roundRobinCounters = new Map<string, number>()

export function normalizeComboModelEntry(entry: ComboModelEntry): NormalizedModelEntry {
  if (typeof entry === 'string') {
    return { model: entry, weight: 1 }
  }
  return {
    model: entry.model,
    weight: entry.weight ?? 1,
    label: entry.label,
    providerId: entry.providerId,
  }
}

export function normalizeComboModels(models: ComboModelEntry[]): NormalizedModelEntry[] {
  return models.map(normalizeComboModelEntry).filter((e) => e.model.length > 0)
}

export function resolveComboModel(
  combo: Combo,
  context: { modelUsageCounts?: Record<string, number> } = {},
): { model: string; index: number } {
  const normalized = normalizeComboModels(combo.models)
  if (normalized.length === 0) {
    throw new Error(`Combo "${combo.name}" has no models configured`)
  }

  const strategy: ComboStrategy = combo.strategy || 'priority'

  switch (strategy) {
    case 'priority':
      return { model: normalized[0].model, index: 0 }

    case 'round-robin': {
      const comboKey = combo.id || combo.name
      const counter = roundRobinCounters.get(comboKey) ?? 0
      const index = counter % normalized.length
      roundRobinCounters.set(comboKey, counter + 1)
      return { model: normalized[index].model, index }
    }

    case 'random': {
      const totalWeight = normalized.reduce((sum, m) => sum + m.weight, 0)
      let rand = Math.random() * totalWeight
      for (let i = 0; i < normalized.length; i++) {
        rand -= normalized[i].weight
        if (rand <= 0) {
          return { model: normalized[i].model, index: i }
        }
      }
      return { model: normalized[0].model, index: 0 }
    }

    case 'weighted': {
      const totalWeight = normalized.reduce((sum, m) => sum + m.weight, 0)
      if (totalWeight <= 0) {
        const index = Math.floor(Math.random() * normalized.length)
        return { model: normalized[index].model, index }
      }
      let rand = Math.random() * totalWeight
      for (let i = 0; i < normalized.length; i++) {
        rand -= normalized[i].weight
        if (rand <= 0) {
          return { model: normalized[i].model, index: i }
        }
      }
      return { model: normalized[normalized.length - 1].model, index: normalized.length - 1 }
    }

    case 'least-used': {
      const usageCounts = context.modelUsageCounts || {}
      let minUsage = Infinity
      let minIndex = 0
      for (let i = 0; i < normalized.length; i++) {
        const usage = usageCounts[normalized[i].model] || 0
        if (usage < minUsage) {
          minUsage = usage
          minIndex = i
        }
      }
      return { model: normalized[minIndex].model, index: minIndex }
    }

    case 'cost-optimized':
    case 'auto':
      return { model: normalized[0].model, index: 0 }

    default:
      return { model: normalized[0].model, index: 0 }
  }
}

export function getComboFallbacks(combo: Combo, primaryIndex: number): string[] {
  const normalized = normalizeComboModels(combo.models)
  return [
    ...normalized.slice(primaryIndex + 1),
    ...normalized.slice(0, primaryIndex),
  ].map((e) => e.model)
}

export function isComboModel(modelId: string, combos: Combo[] | undefined): Combo | undefined {
  if (!combos || combos.length === 0) return undefined
  return combos.find((c) => c.name === modelId && c.isActive !== false)
}

export function getComboModelList(combos: Combo[] | undefined): Array<{
  id: string
  name: string
  strategy: ComboStrategy
  models: string[]
  isActive: boolean
}> {
  if (!combos || combos.length === 0) return []
  return combos.map((combo) => ({
    id: combo.id,
    name: combo.name,
    strategy: combo.strategy,
    models: normalizeComboModels(combo.models).map((e) => e.model),
    isActive: combo.isActive,
  }))
}

export function resetRoundRobinCounter(comboId: string): void {
  roundRobinCounters.delete(comboId)
}

export function resetAllRoundRobinCounters(): void {
  roundRobinCounters.clear()
}
