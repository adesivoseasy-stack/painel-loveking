/**
 * uploader.ts — Upload de instrucoes.md (3 passos, 3 tentativas no passo 3)
 *
 * Spec: METODO-ENVIO-COMPLETO.md §Etapa 3
 * Content-Type DEVE ser idêntico no generate-upload-url e no PUT (sem charset extra).
 */

export interface UploadedPromptFile {
  fileId: string
  fileName: string
  downloadUrl: string
  contentType: string
  sizeBytes: number
}

export async function uploadPromptFile(
  token: string,
  projectId: string,
  document: string,
): Promise<UploadedPromptFile | null> {
  try {
    const fileName    = 'instrucoes.md'
    const contentType = 'text/markdown'   // CRÍTICO: sem charset — deve ser igual no PUT
    const bytes       = new TextEncoder().encode(document)

    const apiHeaders: Record<string, string> = {
      'Content-Type':          'application/json',
      'Accept':                '*/*',
      'Authorization':         `Bearer ${token}`,
      'Origin':                'https://lovable.dev',
      'Referer':               'https://lovable.dev/',
      'x-lovable-project-id':  projectId,
    }

    // PASSO 1: URL assinada
    const uploadResp = await fetch(
      `https://api.lovable.dev/projects/${encodeURIComponent(projectId)}/files/generate-upload-url`,
      {
        method:  'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          content_type:              contentType,
          original_file_name:        fileName,
          file_size_bytes:           bytes.length,
          original_file_size_bytes:  bytes.length,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!uploadResp.ok) {
      console.warn('[uploader] generate-upload-url failed:', uploadResp.status)
      return null
    }

    const uploadData = await uploadResp.json()
    const fileId     = String(uploadData.file_id || '')
    const signedUrl  = String(uploadData.url || uploadData.signed_url || '')
    const gcsHeaders = (uploadData.headers && typeof uploadData.headers === 'object')
      ? uploadData.headers as Record<string, string>
      : {}

    if (!signedUrl || !fileId) {
      console.warn('[uploader] sem signedUrl ou fileId:', JSON.stringify(uploadData).slice(0, 200))
      return null
    }

    // PASSO 2: PUT no GCS
    // Content-Type DEVE ser exatamente igual ao enviado no passo 1 (sem charset)
    const putHeaders: Record<string, string> = { 'Content-Type': contentType }
    for (const [k, v] of Object.entries(gcsHeaders)) putHeaders[k] = String(v)

    const putResp = await fetch(signedUrl, {
      method:  'PUT',
      headers: putHeaders,
      body:    bytes,
      signal:  AbortSignal.timeout(20_000),
    })
    if (!putResp.ok) {
      console.warn('[uploader] PUT failed:', putResp.status)
      return null
    }

    // PASSO 3: Download URL — 3 tentativas com delay crescente (0s, 1.2s, 2.4s)
    const uuid = fileId.split('/').pop() || fileId
    let downloadUrl: string | null = null

    for (let attempt = 0; attempt < 3 && !downloadUrl; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1200 * attempt))
      try {
        const dlResp = await fetch('https://api.lovable.dev/files/generate-download-url', {
          method:  'POST',
          headers: apiHeaders,
          body:    JSON.stringify({ dir_name: projectId, file_name: uuid }),
          signal:  AbortSignal.timeout(10_000),
        })
        if (dlResp.ok) {
          const dlData = await dlResp.json()
          downloadUrl  = String(dlData.url || dlData.download_url || dlData.signed_url || '') || null
        } else {
          console.warn(`[uploader] generate-download-url attempt ${attempt + 1} failed:`, dlResp.status)
        }
      } catch (e) {
        console.warn(`[uploader] generate-download-url attempt ${attempt + 1} exception:`, e)
      }
    }

    if (!downloadUrl) {
      console.warn('[uploader] todas as tentativas de download-url falharam')
      return null
    }

    console.log(`[uploader] ✅ instrucoes.md upado: ${fileId} (${bytes.length} bytes)`)
    return { fileId, fileName, downloadUrl, contentType, sizeBytes: bytes.length }

  } catch (e) {
    console.error('[uploader] exception:', e)
    return null
  }
}
