/**
 * uploader.ts — Sobe o documento do turno como arquivo no Lovable (§4 do MD)
 *
 * Usa o mesmo endpoint de upload de ZIP que já existe na edge function.
 * REGRA FUNDAMENTAL (§4.4): falha nunca derruba o pedido — retorna null e
 * o chamador volta para o caminho antigo (campo message).
 */

export interface PromptFile {
  fileId: string
  fileName: string
  downloadUrl: string
  sizeBytes: number
}

function extractUploadUrl(data: any): string {
  // Extrator tolerante (§4.1): tenta as chaves conhecidas, depois qualquer string URL
  if (typeof data === 'string' && data.startsWith('http')) return data
  if (data?.url && typeof data.url === 'string') return data.url
  if (data?.signedUrl && typeof data.signedUrl === 'string') return data.signedUrl
  if (data?.uploadUrl && typeof data.uploadUrl === 'string') return data.uploadUrl
  if (data?.upload_url && typeof data.upload_url === 'string') return data.upload_url
  // último recurso: qualquer valor string que pareça URL
  for (const v of Object.values(data || {})) {
    if (typeof v === 'string' && v.startsWith('http')) return v
  }
  return ''
}

/**
 * Sobe o conteúdo como arquivo de texto no Lovable e retorna referência.
 * Nunca lança exceção — retorna null em qualquer erro.
 */
export async function uploadPromptAsFile(
  token: string,
  projectId: string,
  content: string,
): Promise<PromptFile | null> {
  try {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(content)
    const sizeBytes = bytes.byteLength

    // §4.1 — cuidado com a extensão: sem sufixo, igual ao que o cliente oficial usa
    // O Lovable parece rotular pelo nome original; "PROMPT" sem extensão é o que o MD recomenda
    const fileName = 'PROMPT'
    const contentType = 'text/plain; charset=utf-8'

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'origin': 'https://lovable.dev',
      'referer': 'https://lovable.dev/',
    }

    // ── Etapa 1: pedir URL de upload (§4.1) ───────────────────────────────────
    const uploadUrlResp = await fetch(
      `https://api.lovable.dev/projects/${encodeURIComponent(projectId)}/files/generate-upload-url`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content_type: contentType,
          original_file_name: fileName,
          file_size_bytes: sizeBytes,
          original_file_size_bytes: sizeBytes,
          file_name: crypto.randomUUID(), // id local aleatório (§4.1)
        }),
        signal: AbortSignal.timeout(10_000), // timeout curto §4.1
      },
    )

    if (!uploadUrlResp.ok) {
      console.warn('[prompt-uploader] generate-upload-url failed:', uploadUrlResp.status, await uploadUrlResp.text().catch(() => ''))
      return null
    }

    const uploadData = await uploadUrlResp.json().catch(() => null)
    if (!uploadData) return null

    const putUrl = extractUploadUrl(uploadData)
    if (!putUrl) {
      console.warn('[prompt-uploader] nenhuma URL de upload na resposta:', JSON.stringify(uploadData).slice(0, 200))
      return null
    }

    const fileId = uploadData.file_id || uploadData.file_name || uploadData.path || uploadData.key || crypto.randomUUID()
    const extraHeaders: Record<string, string> = uploadData.headers || {}

    // ── Etapa 2: subir os bytes (§4.2) ────────────────────────────────────────
    const putResp = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType, ...extraHeaders },
      body: bytes,
      signal: AbortSignal.timeout(20_000), // timeout maior §4.2
    })

    if (!putResp.ok) {
      console.warn('[prompt-uploader] PUT failed:', putResp.status, await putResp.text().catch(() => ''))
      return null
    }

    // Tentar obter download URL (opcional — falha é silenciosa)
    let downloadUrl = ''
    try {
      const dirName = String(fileId || '').split('/')[0]
      const dlResp = await fetch('https://api.lovable.dev/files/generate-download-url', {
        method: 'POST',
        headers,
        body: JSON.stringify({ dir_name: dirName, file_name: fileId }),
        signal: AbortSignal.timeout(8_000),
      })
      if (dlResp.ok) {
        const dlData = await dlResp.json()
        downloadUrl = dlData.url || ''
      }
    } catch (_) {
      // silencioso
    }

    console.log(`[prompt-uploader] ✅ documento enviado como arquivo: ${fileId} (${sizeBytes} bytes)`)
    return { fileId: String(fileId), fileName, downloadUrl, sizeBytes }

  } catch (err) {
    console.warn('[prompt-uploader] exceção (fallback para campo message):', err)
    return null // §4.4 — falha nunca derruba o pedido
  }
}
