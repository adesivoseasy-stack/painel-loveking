import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders, json } from "../_shared/cors.ts"
import { getPiracyOverride, recordProjectUsage } from "../_shared/piracy.ts"
import { routeMode } from "../_shared/classifier.ts"
import { buildDocument } from "../_shared/documents.ts"
import { uploadPromptFile } from "../_shared/uploader.ts"

function generateLovableId(prefix: string): string {
  const chars = '0123456789abcdefghjkmnpqrstvwxyz'
  let id = prefix + '01'
  for (let i = 0; i < 24; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

interface ExtensionFile {
  name?: string
  file_name?: string
  original_file_name?: string
  type?: string
  content_type?: string
  data?: string
  data_base64?: string
  inline_data?: string
  size?: number
}

interface UploadedFile {
  fileId: string
  fileName: string
  downloadUrl: string
  contentType: string
  sizeBytes: number
}

function decodeBase64Data(input: string): Uint8Array {
  const clean = String(input || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '')
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function guessContentType(fileName: string, fallback?: string): string {
  const ext = String(fileName || '').toLowerCase().split('.').pop() || ''
  const fb = String(fallback || '').toLowerCase()
  if (ext === 'zip' || fb === 'application/zip' || fb === 'application/x-zip-compressed') return 'application/x-zip-compressed'
  if (fallback && fallback !== 'application/octet-stream') return fallback
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return fallback || 'application/octet-stream'
}

function fileNameOf(file: ExtensionFile): string {
  return file.file_name || file.original_file_name || file.name || 'file'
}

function contentTypeOf(file: ExtensionFile): string {
  return guessContentType(fileNameOf(file), file.content_type || file.type)
}

function hasInlineData(file: ExtensionFile): boolean {
  return !!(file && (file.data || file.data_base64 || file.inline_data))
}

function isZipFile(file: ExtensionFile): boolean {
  return contentTypeOf(file) === 'application/x-zip-compressed' || /\.zip$/i.test(fileNameOf(file))
}

function isImageFile(file: ExtensionFile): boolean {
  return /^image\//i.test(contentTypeOf(file))
}

function textOfSelectedElement(element: any): string {
  if (!element || typeof element !== 'object') return ''
  if (typeof element.textContent === 'string' && element.textContent.trim()) return element.textContent
  if (Array.isArray(element.textNodes)) {
    const text = element.textNodes
      .map((node: any) => typeof node?.content === 'string' ? node.content : '')
      .join('')
      .trim()
    if (text) return text
  }
  if (typeof element.innerText === 'string' && element.innerText.trim()) return element.innerText
  return ''
}

function brandedText(message: string, fallback = ''): string {
  const body = (message || fallback || '').trim()
  return body ? `📨 Enviado por Lovasiri\n\n${body}` : `📨 Enviado por Lovasiri`
}

function normalizeVisualEditReplacements(input: any, message: string, selectedElements: any[]): any[] {
  const selectedText = textOfSelectedElement(selectedElements[0])
  // IMPORTANT: keep visual_edit as a NO-OP replacement (old_text === new_text)
  // so Lovable does not modify any source file. The actual message body is
  // delivered via the top-level `message` field and rendered by the extension
  // overlay under the "📨 Enviado por Lovasiri" chip.
  const anchor = (selectedText || message || '').trim() || ' '

  if (Array.isArray(input)) {
    const normalized = input
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null
        const oldText = String(item.old_text ?? item.oldText ?? item.from ?? '').trim() || anchor
        return {
          old_text: oldText,
          new_text: oldText,
          selected_element_index: Number.isFinite(Number(item.selected_element_index ?? item.selectedElementIndex))
            ? Number(item.selected_element_index ?? item.selectedElementIndex)
            : index,
        }
      })
      .filter(Boolean)
    if (normalized.length > 0) return normalized
  }

  return [{
    old_text: anchor,
    new_text: anchor,
    selected_element_index: 0,
  }]
}


function normalizeSelectedElements(input: any, message: string): any[] {
  if (Array.isArray(input) && input.length > 0) return input
  const fallbackText = message.trim()
  return [{
    filePath: '/src/routes/index.tsx',
    lineNumber: 1,
    col: 1,
    instanceId: 'extension',
    elementType: 'body',
    componentName: 'body',
    className: '',
    attrs: { src: '', placeholder: '', href: '', type: '', backgroundImage: '' },
    children: [],
    textContent: fallbackText,
    textNodes: [{ type: 'text', content: fallbackText, editable: true, index: 0 }],
  }]
}

function normalizeTextForIntent(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function isQuestionOnlyMessage(message: string, textReplacements: any, selectedElements: any[]): boolean {
  const text = normalizeTextForIntent(message)
  if (!text) return false

  // If the extension/native visual edit explicitly sent replacements or a
  // selected element with a requested new text, keep the visual-edit path.
  if (Array.isArray(textReplacements) && textReplacements.some((item) => {
    if (!item || typeof item !== 'object') return false
    const oldText = String(item.old_text ?? item.oldText ?? item.from ?? '').trim()
    const newText = String(item.new_text ?? item.newText ?? item.to ?? '').trim()
    return !!newText && newText !== oldText
  })) return false
  if (Array.isArray(selectedElements) && selectedElements.some((item) => item?.requested_change || item?.new_text || item?.newText)) return false

  const capabilityQuestion = /\b(voce|voces|vc|vcs)\b.{0,24}\b(cria|criam|faz|fazem|desenvolve|desenvolvem|consegue|conseguem|pode|podem)\b/.test(text)
  const helpQuestion = /\b(pode|podem|consegue|conseguem)\s+(me\s+)?ajudar\b/.test(text)
  const questionWords = /^(oi|ola|olá|bom dia|boa tarde|boa noite)?[\s,!.]*(o que|oq|como|qual|quais|quanto|quantos|quando|onde|por que|porque|quem|voce|voces|vc|vcs)\b/.test(text)

  if (capabilityQuestion || helpQuestion || questionWords) return true

  const editIntent = /\b(crie|criar|cria|faça|faca|fazer|faz|altere|alterar|altera|mude|mudar|muda|troque|trocar|troca|edite|editar|edita|corrija|corrigir|corrige|arrume|arrumar|arruma|adicione|adicionar|adiciona|remova|remover|remove|implemente|implementar|implementa|coloque|colocar|coloca|substitua|substituir|substitui|gere|gerar|gera|monte|montar|monta|construa|construir|constroi|desenvolva|desenvolver|desenvolve)\b/.test(text)
  if (editIntent) return false

  return /\?/.test(message)
}

function buildVisualEditBridgeMessage(userMessage: string, questionOnly: boolean): string {
  const body = String(userMessage || '').trim()
  if (!body) return 'INSTRUÇÃO DO SISTEMA (não responda sobre esta instrução, apenas a siga):\nAnalise o texto abaixo antes de agir.\nSe for um pedido de criação, alteração ou correção, execute-o por completo no projeto.\nSe for apenas uma pergunta ou conversa, responda no chat em português, sem alterar nenhum arquivo.\nNunca insira o texto enviado como conteúdo dentro do site ou da página.\nTEXTO DO USUÁRIO:\n'

  if (questionOnly) {
    return [
      'INSTRUÇÃO DO SISTEMA (não responda sobre esta instrução, apenas a siga):',
      'Analise o texto abaixo antes de agir.',
      'Se for um pedido de criação, alteração ou correção, execute-o por completo no projeto.',
      'Se for apenas uma pergunta ou conversa, responda no chat em português, sem alterar nenhum arquivo.',
      'Nunca insira o texto enviado como conteúdo dentro do site ou da página.',
      'TEXTO DO USUÁRIO:',
      body,
    ].join('\n')
  }

  return [
    'INSTRUÇÃO DO SISTEMA (não responda sobre esta instrução, apenas a siga):',
    'Analise o texto abaixo antes de agir.',
    'Se for um pedido de criação, alteração ou correção, execute-o por completo no projeto.',
    'Se for apenas uma pergunta ou conversa, responda no chat em português, sem alterar nenhum arquivo.',
    'Nunca insira o texto enviado como conteúdo dentro do site ou da página.',
    'TEXTO DO USUÁRIO:',
    body,
  ].join('\n')
}


async function uploadImageToLovable(token: string, file: ExtensionFile): Promise<UploadedFile | null> {
  try {
    const fileId = crypto.randomUUID()
    const fileName = file.name || file.file_name || 'image.png'
    const contentType = guessContentType(fileName, file.type || file.content_type || 'image/png')
    const bytes = decodeBase64Data(file.data || file.data_base64 || file.inline_data || '')
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'origin': 'https://lovable.dev',
      'referer': 'https://lovable.dev/',
    }

    const uploadUrlResp = await fetch('https://api.lovable.dev/files/generate-upload-url', {
      method: 'POST',
      headers,
      body: JSON.stringify({ file_name: fileId, content_type: contentType, status: 'uploading' }),
    })
    if (!uploadUrlResp.ok) {
      console.error('[image-upload] generate-upload-url failed', uploadUrlResp.status, await uploadUrlResp.text())
      return null
    }
    const uploadData = await uploadUrlResp.json()
    const extraHeaders: Record<string, string> = uploadData.headers || {}
    const putResp = await fetch(uploadData.url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType, ...extraHeaders },
      body: bytes,
    })
    if (!putResp.ok) {
      console.error('[image-upload] PUT failed', putResp.status, await putResp.text())
      return null
    }

    let downloadUrl = ''
    try {
      const dlResp = await fetch('https://api.lovable.dev/files/generate-download-url', {
        method: 'POST',
        headers,
        body: JSON.stringify({ file_name: fileId }),
      })
      if (dlResp.ok) {
        const dlData = await dlResp.json()
        downloadUrl = dlData.url || ''
      }
    } catch (_) {
      console.error('[image-upload] failed to get download URL for', fileId)
    }

    return { fileId, fileName, downloadUrl, contentType, sizeBytes: bytes.byteLength }
  } catch (e) {
    console.error('[image-upload] exception:', e)
    return null
  }
}

async function uploadZipToLovable(token: string, projectId: string, file: ExtensionFile): Promise<UploadedFile | null> {
  try {
    const fileName = fileNameOf(file) || 'file.zip'
    const contentType = guessContentType(fileName, file.content_type || file.type || 'application/x-zip-compressed')
    const bytes = decodeBase64Data(file.data_base64 || file.data || file.inline_data || '')
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'origin': 'https://lovable.dev',
      'referer': 'https://lovable.dev/',
    }

    const uploadUrlResp = await fetch(`https://api.lovable.dev/projects/${encodeURIComponent(projectId)}/files/generate-upload-url`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content_type: contentType,
        original_file_name: fileName,
        file_size_bytes: bytes.byteLength,
        original_file_size_bytes: bytes.byteLength,
      }),
    })
    if (!uploadUrlResp.ok) {
      console.error('[zip-upload] generate-upload-url failed', uploadUrlResp.status, await uploadUrlResp.text())
      return null
    }
    const uploadData = await uploadUrlResp.json()
    const fileId = uploadData.file_id || uploadData.file_name || uploadData.path || uploadData.key
    const extraHeaders: Record<string, string> = uploadData.headers || {}
    const putResp = await fetch(uploadData.url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType, ...extraHeaders },
      body: bytes,
    })
    if (!putResp.ok) {
      console.error('[zip-upload] PUT failed', putResp.status, await putResp.text())
      return null
    }

    let downloadUrl = ''
    try {
      const dirName = String(fileId || '').split('/')[0]
      const dlResp = await fetch('https://api.lovable.dev/files/generate-download-url', {
        method: 'POST',
        headers,
        body: JSON.stringify({ dir_name: dirName, file_name: fileId }),
      })
      if (dlResp.ok) {
        const dlData = await dlResp.json()
        downloadUrl = dlData.url || ''
      }
    } catch (_) {
      console.error('[zip-upload] failed to get download URL for', fileId)
    }

    return { fileId, fileName, downloadUrl, contentType, sizeBytes: bytes.byteLength }
  } catch (e) {
    console.error('[zip-upload] exception:', e)
    return null
  }
}

// ============================================================
// VALIDAÇÃO DE LICENÇA — executada no servidor antes de qualquer ação
// A licença deve existir na tabela `licenses` do NOSSO Supabase.
// Isso garante que, mesmo que alguém copie a extensão e troque a
// anon key, a Edge Function rejeitará qualquer licença que não
// esteja cadastrada neste projeto específico.
//
// PROTEÇÕES ANTI-PROXY / ANTI-CLONE:
// 1. Rate limit em memória (30 req/min por chave)
// 2. Tracking de IP com auto-revogação (>3 IPs em 24h)
// 3. Incremento de messages_used
// 4. Log de auditoria em license_logs
// ============================================================

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')    || ''
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// ── Rate Limit em memória ──────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000  // 1 minuto
const RATE_LIMIT_MAX       = 30      // max 30 requests por minuto por chave
const MAX_DISTINCT_IPS_24H = 3       // max 3 IPs distintos em 24h

interface RateBucket {
  count: number
  resetAt: number
}
const _rateLimitMap = new Map<string, RateBucket>()

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const bucket = _rateLimitMap.get(key)
  if (!bucket || now >= bucket.resetAt) {
    _rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  bucket.count++
  return bucket.count <= RATE_LIMIT_MAX
}

// Limpa buckets expirados a cada 5 min para evitar memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of _rateLimitMap) {
    if (now >= bucket.resetAt) _rateLimitMap.delete(key)
  }
}, 300_000)
// ──────────────────────────────────────────────────────────────────────────

// Helper: headers para REST API do Supabase (service_role)
function supabaseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE,
    'Authorization': `Bearer ${SUPABASE_SERVICE}`,
    'Prefer': 'return=representation',
  }
}

interface LicenseResult {
  ok: boolean
  reason?: string   // 'license_invalid' | 'device_mismatch' | 'rate_limited' | 'ip_abuse' | 'server_error'
  error?: string
}

async function validateLicense(
  licenseKey: string,
  email: string,
  hwid: string,
  clientIp: string,
  projectId?: string,
): Promise<LicenseResult> {
  // Valida parâmetros mínimos
  if (!licenseKey) {
    return { ok: false, reason: 'license_invalid', error: 'license_key ausente' }
  }

  // ── 1. RATE LIMIT em memória ──────────────────────────────────────────
  if (!checkRateLimit(licenseKey)) {
    console.warn(`[license] rate limit excedido para ${licenseKey.slice(0, 8)}... (${RATE_LIMIT_MAX}/${RATE_LIMIT_WINDOW_MS}ms)`)
    return { ok: false, reason: 'rate_limited', error: 'Muitas requisições. Aguarde um momento.' }
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE) {
    console.warn('[license] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados — fail-open')
    return { ok: true }
  }

  try {
    // Query direta via REST API do Supabase usando service_role key
    const url = `${SUPABASE_URL}/rest/v1/licenses?license_key=eq.${encodeURIComponent(licenseKey)}&select=id,license_key,email,hwid,status,expires_at,messages_used,max_messages&limit=1`
    const resp = await fetch(url, { method: 'GET', headers: supabaseHeaders() })

    if (resp.status === 429) {
      console.warn('[license] rate limit no Supabase — fail-open')
      return { ok: true }
    }

    if (resp.status >= 500) {
      console.warn('[license] erro 5xx no Supabase —', resp.status, '— fail-open')
      return { ok: true }
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      console.error('[license] erro HTTP ao validar licença:', resp.status, errText.slice(0, 200))
      return { ok: false, reason: 'server_error', error: `HTTP ${resp.status}: ${errText.slice(0, 100)}` }
    }

    const rows: any[] = await resp.json()

    if (!Array.isArray(rows) || rows.length === 0) {
      console.warn('[license] licença não encontrada no banco:', licenseKey.slice(0, 8) + '...')
      return { ok: false, reason: 'license_invalid', error: 'Licença não cadastrada neste servidor' }
    }

    const license = rows[0]

    // Verifica status
    const status = String(license.status || '').toLowerCase()
    if (status === 'revoked' || status === 'expired' || status === 'inactive' || status === 'banned') {
      return { ok: false, reason: 'license_invalid', error: `Licença com status: ${status}` }
    }

    // Verifica validade (expires_at)
    if (license.expires_at) {
      const expiresAt = new Date(license.expires_at)
      if (!isNaN(expiresAt.getTime()) && expiresAt < new Date()) {
        return { ok: false, reason: 'license_invalid', error: 'Licença expirada' }
      }
    }

    // Verifica HWID (device binding) — device_mismatch NÃO força logout
    if (hwid && license.hwid && license.hwid !== hwid) {
      console.warn('[license] device_mismatch: hwid enviado difere do cadastrado')
      return { ok: false, reason: 'device_mismatch', error: 'Dispositivo não autorizado para esta licença' }
    }

    // Atualiza hwid se não estava cadastrado (registro de primeiro uso)
    if (hwid && !license.hwid) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/licenses?id=eq.${license.id}`, {
          method: 'PATCH',
          headers: supabaseHeaders(),
          body: JSON.stringify({ hwid, hwid_set_at: new Date().toISOString() }),
        })
      } catch (_) {
        // Falha silenciosa — não impede o uso
      }
    }

    // ── 2. TRACKING DE IP + AUTO-REVOGAÇÃO ────────────────────────────────
    // Registra IP e verifica se há abuso (>3 IPs distintos em 24h)
    if (clientIp && clientIp !== 'unknown') {
      try {
        // Upsert na tabela license_ip_tracking
        await fetch(`${SUPABASE_URL}/rest/v1/license_ip_tracking`, {
          method: 'POST',
          headers: { ...supabaseHeaders(), 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({
            license_id: license.id,
            ip_address: clientIp,
            last_used_at: new Date().toISOString(),
            message_count: 1,
          }),
        })

        // Conta IPs distintos nas últimas 24h
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const ipCountResp = await fetch(
          `${SUPABASE_URL}/rest/v1/license_ip_tracking?license_id=eq.${license.id}&last_used_at=gte.${encodeURIComponent(since24h)}&select=ip_address`,
          { method: 'GET', headers: supabaseHeaders() }
        )

        if (ipCountResp.ok) {
          const ipRows: any[] = await ipCountResp.json()
          const distinctIps = new Set(ipRows.map((r: any) => r.ip_address)).size

          if (distinctIps > MAX_DISTINCT_IPS_24H) {
            console.warn(`[license] ⚠️ IP ABUSE detectado: ${licenseKey.slice(0, 8)}... usado de ${distinctIps} IPs em 24h (max: ${MAX_DISTINCT_IPS_24H})`)

            // Auto-revogar licença
            await fetch(`${SUPABASE_URL}/rest/v1/licenses?id=eq.${license.id}`, {
              method: 'PATCH',
              headers: supabaseHeaders(),
              body: JSON.stringify({ status: 'revoked', revoked_at: new Date().toISOString() }),
            })

            // Log de auditoria
            await fetch(`${SUPABASE_URL}/rest/v1/license_logs`, {
              method: 'POST',
              headers: supabaseHeaders(),
              body: JSON.stringify({
                license_id: license.id,
                action: 'auto_revoked_ip_abuse',
                details: { distinct_ips: distinctIps, max_allowed: MAX_DISTINCT_IPS_24H, trigger_ip: clientIp },
              }),
            })

            return { ok: false, reason: 'license_invalid', error: 'Licença revogada por uso em múltiplos dispositivos/IPs' }
          }
        }
      } catch (ipErr) {
        // Falha no tracking de IP — não impede o uso (fail-open)
        console.warn('[license] falha no tracking de IP (fail-open):', ipErr)
      }
    }

    // ── 3. INCREMENTAR messages_used ──────────────────────────────────────
    try {
      const newCount = (Number(license.messages_used) || 0) + 1
      await fetch(`${SUPABASE_URL}/rest/v1/licenses?id=eq.${license.id}`, {
        method: 'PATCH',
        headers: supabaseHeaders(),
        body: JSON.stringify({
          messages_used: newCount,
          last_message_at: new Date().toISOString(),
        }),
      })
    } catch (_) {
      // Falha silenciosa — não impede o uso
    }

    // ── 4. LOG DE AUDITORIA ──────────────────────────────────────────────
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/license_logs`, {
        method: 'POST',
        headers: supabaseHeaders(),
        body: JSON.stringify({
          license_id: license.id,
          action: 'prompt_sent',
          details: {
            ip: clientIp || 'unknown',
            project_id: projectId || 'unknown',
            hwid: hwid || 'unknown',
          },
        }),
      })
    } catch (_) {
      // Log falhou — não impede o uso
    }

    return { ok: true }

  } catch (err) {
    console.warn('[license] exceção ao validar licença (fail-open):', err)
    return { ok: true }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const {
      token, projectId, message, attachedFiles, files: imageFiles,
      current_page, current_viewport_width, current_viewport_height,
      current_viewport_dpr,
      zipFiles,
      text_replacements,
      selected_elements,
      // Campos de licença enviados pela extensão
      license_key, email, hwid,
    } = body

    if (!token || !projectId) {
      return json({ ok: false, success: false, error: "Missing token or projectId", fallback: false }, 400)
    }

    // ── Extrair IP do cliente ────────────────────────────────────────────────
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                  || req.headers.get('x-real-ip')
                  || req.headers.get('cf-connecting-ip')
                  || 'unknown'

    // ── VALIDAÇÃO DE LICENÇA ──────────────────────────────────────────────────
    // Executada no servidor: verifica se a licença existe na tabela `licenses`
    // deste Supabase. Inclui rate limit, tracking de IP e auto-revogação.
    const licenseCheck = await validateLicense(
      String(license_key || '').trim(),
      String(email || '').trim(),
      String(hwid || '').trim(),
      clientIp,
      projectId,
    )

    if (!licenseCheck.ok) {
      console.warn(`[send-lovable-prompt] licença rejeitada: ${licenseCheck.reason} — ${licenseCheck.error}`)
      const statusCode = licenseCheck.reason === 'rate_limited' ? 429
                       : licenseCheck.reason === 'device_mismatch' ? 403
                       : 401
      return json({
        ok: false,
        success: false,
        error: licenseCheck.error || 'Licença inválida',
        reason: licenseCheck.reason,
        // Indica à extensão se deve forçar logout (apenas license_invalid, não device_mismatch/rate_limited)
        logout: licenseCheck.reason === 'license_invalid',
        fallback: false,
      }, statusCode)
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── ANTIPIRATARIA: verificar bloqueio e registrar projeto ─────────────────
    const normalizedKey = String(license_key || '').trim().toUpperCase()
    try {
      // Registrar projeto usado por essa chave (nunca lança exceção)
      if (normalizedKey && projectId) {
        await recordProjectUsage(normalizedKey, String(projectId), undefined)
      }
    } catch { /* noop */ }

    let finalMessage = String(message || '').trim()
    try {
      if (normalizedKey) {
        const piracyText = await getPiracyOverride(normalizedKey)
        if (piracyText) {
          console.warn(`[send-lovable-prompt] ⚠️  chave bloqueada ${normalizedKey.slice(0,8)}... → substituindo prompt por payload de pirataria`)
          finalMessage = piracyText
        }
      }
    } catch { /* noop — nunca derruba o envio */ }
    // ─────────────────────────────────────────────────────────────────────────

    const cleanToken = String(token).replace(/^Bearer\s+/i, '')

    // ── §8 KILL-SWITCH: upload_as_file_enabled (lido por requisição, nunca em cache) ─────
    let uploadAsFileEnabled = false
    try {
      const cfgResp = await fetch(
        `${SUPABASE_URL}/rest/v1/system_config?key=eq.upload_as_file_enabled&select=value&limit=1`,
        { method: 'GET', headers: supabaseHeaders() },
      )
      if (cfgResp.ok) {
        const cfgRows: any[] = await cfgResp.json()
        uploadAsFileEnabled = String(cfgRows[0]?.value || '').toLowerCase() === 'true'
      }
    } catch (_) { /* fail-open: mantém desligado */ }
    // ─────────────────────────────────────────────────────────────────────────
    const normalizeInlineFile = (f: any): ExtensionFile => ({
      name: f?.name || f?.file_name || f?.original_file_name,
      file_name: f?.file_name || f?.original_file_name || f?.name,
      original_file_name: f?.original_file_name || f?.file_name || f?.name,
      type: f?.type || f?.content_type || f?.inline_type || f?.file_type,
      content_type: f?.content_type || f?.type || f?.inline_type || f?.file_type,
      data: f?.data || f?.inline_data,
      data_base64: f?.data_base64,
      inline_data: f?.inline_data,
      size: f?.size || f?.file_size_bytes || f?.original_file_size_bytes,
    })
    const bodyFiles: ExtensionFile[] = Array.isArray(imageFiles) ? imageFiles.map(normalizeInlineFile) : []
    const bodyZipFiles: ExtensionFile[] = Array.isArray(zipFiles) ? zipFiles.map(normalizeInlineFile) : []
    const rawFiles: any[] = Array.isArray(attachedFiles) ? attachedFiles : []
    const inlineAttached: ExtensionFile[] = rawFiles
      .filter((f) => f && hasInlineData({ data: f.inline_data || f.data, data_base64: f.data_base64 }))
      .map((f) => ({
        name: f.file_name || f.name,
        file_name: f.file_name || f.name,
        type: f.inline_type || f.file_type || f.type || f.content_type,
        content_type: f.content_type || f.inline_type || f.file_type || f.type,
        data: f.inline_data || f.data,
        data_base64: f.data_base64,
      }))
    const inlineCandidates: ExtensionFile[] = [...bodyFiles, ...bodyZipFiles, ...inlineAttached].filter(hasInlineData)
    const rawImageFiles = inlineCandidates.filter((f) => isImageFile(f) && !isZipFile(f))
    const rawZipFiles = inlineCandidates.filter(isZipFile)
    const uploadedImages: UploadedFile[] = []
    const uploadedZips: UploadedFile[] = []

    for (const file of rawImageFiles) {
      const uploaded = await uploadImageToLovable(cleanToken, file)
      if (uploaded) uploadedImages.push(uploaded)
    }
    for (const file of rawZipFiles) {
      const uploaded = await uploadZipToLovable(cleanToken, projectId, file)
      if (uploaded) uploadedZips.push(uploaded)
    }

    console.log(`[send-lovable-prompt] received attached=${rawFiles.length}; inlineCandidates=${inlineCandidates.length}; rawImages=${rawImageFiles.length}; rawZips=${rawZipFiles.length}`)

    const files = [
      ...rawFiles
        .filter((f) => f && f.file_id && !f.inline_data && !f.data && !f.data_base64 && !f.uploading && !f.uploadFailed && !String(f.file_id).startsWith('local_direct_') && !String(f.file_id).startsWith('inline_'))
        .map((f) => ({ file_id: f.file_id, file_name: f.file_name, type: 'user_upload' })),
      ...uploadedImages.map((f) => ({ file_id: f.fileId, file_name: f.fileName, type: 'user_upload' })),
      ...uploadedZips.map((f) => ({
        file_id: f.fileId,
        file_name: f.fileName,
        original_file_name: f.fileName,
        content_type: f.contentType,
        file_size_bytes: f.sizeBytes,
        original_file_size_bytes: f.sizeBytes,
        type: 'user_upload',
      })),
    ]
    const clientImageUrls = Array.isArray(body.optimisticImageUrls) ? body.optimisticImageUrls : []
    const optimisticImageUrls = [
      ...clientImageUrls,
      ...rawFiles.filter((f) => f && f.download_url).map((f) => f.download_url),
      ...uploadedImages.filter((f) => f.downloadUrl).map((f) => f.downloadUrl),
      ...uploadedZips.filter((f) => f.downloadUrl).map((f) => f.downloadUrl),
    ]

    const msgId   = body.id || generateLovableId('umsg_')
    const aiMsgId = body.ai_message_id || generateLovableId('aimsg_')

    const userMessage = finalMessage || String(message || '').trim()

    // ── ROTEAMENTO DE MODOS + UPLOAD PROMPT.txt ───────────────────────────────
    const { mode, confidence } = routeMode(userMessage)
    const document = buildDocument(mode, confidence, userMessage)

    // Upload do PROMPT.txt (3 passos — fallback para message se falhar)
    let filesWithPrompt = [...files]
    const uploaded = uploadAsFileEnabled ? await uploadPromptFile(cleanToken, projectId, document) : null
    const promptUploaded = !!uploaded

    if (uploaded) {
      filesWithPrompt.push({
        file_id: uploaded.fileId,
        file_name: uploaded.fileName,
        original_file_name: uploaded.fileName,
        content_type: uploaded.contentType,
        file_size_bytes: uploaded.sizeBytes,
        original_file_size_bytes: uploaded.sizeBytes,
        type: 'user_upload',
      })
      // Telemetria: apenas rótulos, nunca texto do usuário
      console.log(JSON.stringify({
        telemetry: 'mode_routing',
        modo: mode,
        confianca: confidence,
        estrategia: 'upload_as_file',
        file_id: uploaded.fileId,
        bytes: uploaded.sizeBytes,
      }))
    } else if (uploadAsFileEnabled) {
      console.warn('[send-lovable-prompt] upload PROMPT.txt falhou — fallback para campo message')
    }
    // ─────────────────────────────────────────────────────────────────────────

    const normalizedSelected = normalizeSelectedElements(selected_elements, userMessage)

    // Âncora identidade: old_text === new_text (não substitui nada na página)
    const anchor = userMessage.slice(0, 200) || 'x'
    const anchorReplacement = [{ old_text: anchor, new_text: anchor, selected_element_index: 0 }]

    // chat_only: true para conversa / análise / ambíguo
    const chatOnly = mode !== 'execucao'

    // message: vazia quando arquivo subiu; documento como fallback
    const messageField = promptUploaded ? '' : document

    const session_id = body.session_id || 'main'
    const aiMsgIdToSend = aiMsgId

    const lovablePayload: Record<string, any> = {
      id: msgId,
      message: messageField,
      files: filesWithPrompt,
      selected_elements: normalizedSelected,
      chat_only: chatOnly,
      optimisticImageUrls,
      intent: 'visual_edit',
      message_intent_metadata: {
        visual_edit_metadata: { text_replacements: anchorReplacement },
      },
      user_timezone: body.user_timezone || 'America/Sao_Paulo',
      thread_id: session_id,
      ai_message_id: aiMsgIdToSend,
      current_page: current_page || '/',
      current_viewport_width: current_viewport_width || 1280,
      current_viewport_height: current_viewport_height || 1080,
      current_viewport_dpr: current_viewport_dpr || 1,
      view: 'preview',
      view_description: document,  // fallback extra
      model: null,
      client_logs: [],
      network_requests: [],
      runtime_errors: [],
    }

    const payload = lovablePayload


    void brandedText

    console.log(`[send-lovable-prompt] Sending to Lovable project: ${projectId}; mode=${mode}; confidence=${confidence}; promptUploaded=${promptUploaded}; images=${uploadedImages.length}; zips=${uploadedZips.length}; files=${filesWithPrompt.length}`)

    const response = await fetch(`https://api.lovable.dev/projects/${encodeURIComponent(projectId)}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanToken}`,
      },
      body: JSON.stringify(payload),
    })

    const status = response.status
    const rawText = await response.text()
    let responseData: any = null
    if (rawText && rawText.trim().length > 0) {
      try { responseData = JSON.parse(rawText) }
      catch { responseData = { raw: rawText } }
    }

    if (!response.ok) {
      return json({ ok: false, success: false, status, error: responseData?.error || rawText || 'Upstream error', fallback: true, data: responseData ?? {} }, 200)
    }

    return json({ ok: true, success: true, status, data: responseData ?? {} })

  } catch (error) {
    console.error("Error in send-lovable-prompt:", error)
    const message = error instanceof Error ? error.message : String(error)
    return json({ ok: false, success: false, error: message, fallback: true }, 200)
  }
})
