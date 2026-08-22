/**
 * uploader.ts — Upload de PROMPT.txt (3 passos obrigatórios)
 *
 * CRÍTICO: sem o passo 3 (generate-download-url) o arquivo sobe mas não aparece no chat.
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
    const bytes = new TextEncoder().encode(document)
    const contentType = 'text/plain; charset=utf-8'
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'origin': 'https://lovable.dev',
      'referer': 'https://lovable.dev/',
    }

    // PASSO 1: gerar URL de upload
    const uploadUrlResp = await fetch(
      `https://api.lovable.dev/projects/${encodeURIComponent(projectId)}/files/generate-upload-url`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content_type: contentType,
          original_file_name: 'PROMPT.txt',
          file_size_bytes: bytes.byteLength,
          original_file_size_bytes: bytes.byteLength,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!uploadUrlResp.ok) {
      console.warn('[v1-doc] generate-upload-url failed:', uploadUrlResp.status)
      return null
    }

    const uploadData = await uploadUrlResp.json()
    const fileId = uploadData.file_id || uploadData.file_name || uploadData.path || uploadData.key
    if (!fileId || !uploadData.url) {
      console.warn('[v1-doc] resposta do upload sem fileId ou url:', JSON.stringify(uploadData).slice(0, 200))
      return null
    }
    // Headers extras da resposta do passo 1 DEVEM ir no PUT (ex: x-goog-content-length-range)
    const extraHeaders: Record<string, string> = uploadData.headers || {}

    // PASSO 2: PUT com os bytes + extraHeaders obrigatórios
    const putResp = await fetch(uploadData.url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType, ...extraHeaders },
      body: bytes,
      signal: AbortSignal.timeout(20_000),
    })
    if (!putResp.ok) {
      console.warn('[v1-doc] PUT failed:', putResp.status)
      return null
    }

    // PASSO 3: generate-download-url — SEM ISSO o arquivo não aparece no chat!
    // dir_name = primeira parte do fileId (ex: "abc123" de "abc123/PROMPT.txt")
    let downloadUrl = ''
    const dirName = String(fileId || '').split('/')[0]
    try {
      const dlResp = await fetch('https://api.lovable.dev/files/generate-download-url', {
        method: 'POST',
        headers,
        body: JSON.stringify({ dir_name: dirName, file_name: fileId }),
        signal: AbortSignal.timeout(10_000),
      })
      if (dlResp.ok) {
        const dlData = await dlResp.json()
        downloadUrl = dlData.url || ''
      } else {
        console.warn('[v1-doc] generate-download-url failed:', dlResp.status)
        // sem download URL o arquivo não aparece → falha
        return null
      }
    } catch (e) {
      console.warn('[v1-doc] generate-download-url exception:', e)
      return null
    }

    console.log(`[v1-doc] ✅ PROMPT.txt upado: ${fileId} (${bytes.byteLength} bytes)`)
    return { fileId: String(fileId), fileName: 'PROMPT.txt', downloadUrl, contentType, sizeBytes: bytes.byteLength }
  } catch (e) {
    console.error('[v1-doc] exception:', e)
    return null
  }
}
