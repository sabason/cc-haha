/**
 * Providers REST API
 *
 * GET    /api/providers              — list all saved providers + activeId
 * GET    /api/providers/presets       — list available presets
 * GET    /api/providers/auth-status   — check whether any usable auth exists
 * GET    /api/providers/settings      — read cc-haha managed settings.json
 * POST   /api/providers              — add a provider
 * PUT    /api/providers/settings      — update cc-haha managed settings.json
 * PUT    /api/providers/:id          — update a provider
 * DELETE /api/providers/:id          — delete a provider
 * POST   /api/providers/:id/activate — activate a saved provider
 * POST   /api/providers/official     — activate official (clear env)
 * POST   /api/providers/:id/test     — test a saved provider
 * POST   /api/providers/test         — test unsaved config
 *
 * Combo management (within a provider):
 * GET    /api/providers/:id/combos           — list combos for a provider
 * POST   /api/providers/:id/combos           — add a combo to a provider
 * PUT    /api/providers/:id/combos/:comboId  — update a combo
 * DELETE /api/providers/:id/combos/:comboId  — delete a combo
 * POST   /api/providers/:id/combos/sync      — sync combos from OmniRoute server
 */

import { z } from 'zod'
import { ProviderService } from '../services/providerService.js'
import { PROVIDER_PRESETS } from '../config/providerPresets.js'
import {
  CreateProviderSchema,
  UpdateProviderSchema,
  TestProviderSchema,
  ComboSchema,
} from '../types/provider.js'
import { getComboModelList } from '../services/comboResolver.js'
import { ApiError, errorResponse } from '../middleware/errorHandler.js'

const providerService = new ProviderService()

export async function handleProvidersApi(
  req: Request,
  _url: URL,
  segments: string[],
): Promise<Response> {
  try {
    const id = segments[2]
    const action = segments[3]

    // POST /api/providers/test
    if (id === 'test' && req.method === 'POST') {
      return await handleTestUnsaved(req)
    }

    // GET /api/providers/presets
    if (id === 'presets' && req.method === 'GET') {
      return Response.json({ presets: PROVIDER_PRESETS })
    }

    // GET /api/providers/auth-status
    if (id === 'auth-status' && req.method === 'GET') {
      const status = await providerService.checkAuthStatus()
      return Response.json(status)
    }

    // /api/providers/settings
    if (id === 'settings') {
      if (req.method === 'GET') {
        return Response.json(await providerService.getManagedSettings())
      }
      if (req.method === 'PUT') {
        const body = await parseJsonBody(req)
        await providerService.updateManagedSettings(body)
        return Response.json({ ok: true })
      }
      throw methodNotAllowed(req.method)
    }

    // POST /api/providers/official
    if (id === 'official' && req.method === 'POST') {
      await providerService.activateOfficial()
      return Response.json({ ok: true })
    }

    // /api/providers (no ID)
    if (!id) {
      if (req.method === 'GET') {
        const { providers, activeId } = await providerService.listProviders()
        return Response.json({ providers, activeId })
      }
      if (req.method === 'POST') {
        return await handleCreate(req)
      }
      throw methodNotAllowed(req.method)
    }

    // /api/providers/:id/activate
    if (action === 'activate') {
      if (req.method !== 'POST') throw methodNotAllowed(req.method)
      await providerService.activateProvider(id)
      return Response.json({ ok: true })
    }

    // /api/providers/:id/test
    if (action === 'test') {
      if (req.method !== 'POST') throw methodNotAllowed(req.method)
      let overrides: { baseUrl?: string; modelId?: string; apiFormat?: string } | undefined
      try {
        const body = await req.json()
        if (body && typeof body === 'object') overrides = body as typeof overrides
      } catch { /* no body is fine — uses saved values */ }
      const result = await providerService.testProvider(id, overrides)
      return Response.json({ result })
    }

    // /api/providers/:id/combos/*
    if (action === 'combos') {
      const comboAction = segments[4]
      return await handleCombosRoute(req, id, comboAction, segments)
    }

    // /api/providers/:id
    if (req.method === 'GET') {
      const provider = await providerService.getProvider(id)
      return Response.json({ provider })
    }
    if (req.method === 'PUT') {
      return await handleUpdate(req, id)
    }
    if (req.method === 'DELETE') {
      await providerService.deleteProvider(id)
      return Response.json({ ok: true })
    }

    throw methodNotAllowed(req.method)
  } catch (error) {
    return errorResponse(error)
  }
}

async function handleCreate(req: Request): Promise<Response> {
  const body = await parseJsonBody(req)
  try {
    const input = CreateProviderSchema.parse(body)
    const provider = await providerService.addProvider(input)
    return Response.json({ provider }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) throw ApiError.badRequest(err.issues.map((i) => i.message).join('; '))
    throw err
  }
}

async function handleUpdate(req: Request, id: string): Promise<Response> {
  const body = await parseJsonBody(req)
  try {
    const input = UpdateProviderSchema.parse(body)
    const provider = await providerService.updateProvider(id, input)
    return Response.json({ provider })
  } catch (err) {
    if (err instanceof z.ZodError) throw ApiError.badRequest(err.issues.map((i) => i.message).join('; '))
    throw err
  }
}

async function handleTestUnsaved(req: Request): Promise<Response> {
  const body = await parseJsonBody(req)
  try {
    const input = TestProviderSchema.parse(body)
    const result = await providerService.testProviderConfig(input)
    return Response.json({ result })
  } catch (err) {
    if (err instanceof z.ZodError) throw ApiError.badRequest(err.issues.map((i) => i.message).join('; '))
    throw err
  }
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>
  } catch {
    throw ApiError.badRequest('Invalid JSON body')
  }
}

function methodNotAllowed(method: string): ApiError {
  return new ApiError(405, `Method ${method} not allowed`, 'METHOD_NOT_ALLOWED')
}

async function handleCombosRoute(
  req: Request,
  providerId: string,
  comboAction: string | undefined,
  _segments: string[],
): Promise<Response> {
  const provider = await providerService.getProvider(providerId)

  // GET /api/providers/:id/combos — list combos
  if (!comboAction && req.method === 'GET') {
    const combos = getComboModelList(provider.combos)
    return Response.json({ combos })
  }

  // POST /api/providers/:id/combos — add a combo
  if (!comboAction && req.method === 'POST') {
    const body = await parseJsonBody(req)
    const comboInput = ComboSchema.parse(body)
    const existingCombos = provider.combos || []
    const updated = await providerService.updateProvider(providerId, {
      combos: [...existingCombos, comboInput],
    })
    return Response.json({ combo: comboInput, provider: updated }, { status: 201 })
  }

  // POST /api/providers/:id/combos/sync — sync combos from OmniRoute server
  if (comboAction === 'sync' && req.method === 'POST') {
    return await handleComboSync(req, provider)
  }

  // /api/providers/:id/combos/:comboId
  if (comboAction) {
    const comboId = comboAction

    if (req.method === 'GET') {
      const combo = (provider.combos || []).find((c) => c.id === comboId)
      if (!combo) throw ApiError.notFound(`Combo not found: ${comboId}`)
      return Response.json({ combo })
    }

    if (req.method === 'PUT') {
      const body = await parseJsonBody(req)
      const comboUpdate = ComboSchema.parse(body)
      const existingCombos = provider.combos || []
      const idx = existingCombos.findIndex((c) => c.id === comboId)
      if (idx === -1) throw ApiError.notFound(`Combo not found: ${comboId}`)
      const newCombos = [...existingCombos]
      newCombos[idx] = comboUpdate
      const updated = await providerService.updateProvider(providerId, { combos: newCombos })
      return Response.json({ combo: comboUpdate, provider: updated })
    }

    if (req.method === 'DELETE') {
      const existingCombos = provider.combos || []
      const filtered = existingCombos.filter((c) => c.id !== comboId)
      if (filtered.length === existingCombos.length) {
        throw ApiError.notFound(`Combo not found: ${comboId}`)
      }
      const updated = await providerService.updateProvider(providerId, { combos: filtered })
      return Response.json({ ok: true, provider: updated })
    }
  }

  throw methodNotAllowed(req.method)
}

async function handleComboSync(
  req: Request,
  provider: { id: string; baseUrl: string; apiKey: string },
): Promise<Response> {
  const baseUrl = provider.baseUrl.replace(/\/+$/, '')

  try {
    const syncUrl = `${baseUrl}/api/combos`
    const response = await fetch(syncUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw ApiError.internal(`Failed to sync combos from OmniRoute: HTTP ${response.status} ${errText.slice(0, 200)}`)
    }

    const data = await response.json() as { combos?: Array<Record<string, unknown>> }
    const rawCombos = data.combos || []

    const combos = rawCombos.map((raw) => {
      const models = Array.isArray(raw.models)
        ? raw.models.map((m: unknown) => {
            if (typeof m === 'string') return m
            if (typeof m === 'object' && m !== null) {
              const obj = m as Record<string, unknown>
              return {
                model: String(obj.model || ''),
                weight: typeof obj.weight === 'number' ? obj.weight : undefined,
                label: typeof obj.label === 'string' ? obj.label : undefined,
                providerId: typeof obj.providerId === 'string' ? obj.providerId : undefined,
              }
            }
            return String(m)
          })
        : []

      return {
        id: String(raw.id || crypto.randomUUID()),
        name: String(raw.name || ''),
        strategy: String(raw.strategy || 'priority'),
        models: models.filter((m: unknown) => {
          if (typeof m === 'string') return m.length > 0
          return typeof m === 'object' && m !== null && 'model' in m && (m as { model: string }).model.length > 0
        }),
        isActive: raw.isActive !== false,
      }
    }).filter((c) => c.name.length > 0 && c.models.length > 0)

    const validatedCombos = combos.map((c) => ComboSchema.parse(c))

    const updated = await providerService.updateProvider(provider.id, { combos: validatedCombos })
    return Response.json({ synced: validatedCombos.length, combos: validatedCombos, provider: updated })
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw ApiError.internal(`Failed to sync combos: ${err instanceof Error ? err.message : String(err)}`)
  }
}
