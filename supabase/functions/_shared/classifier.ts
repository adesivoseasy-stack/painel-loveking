/**
 * classifier.ts — Roteador de 4 modos via regex (versão final)
 */

export type MessageMode = 'conversa' | 'analise' | 'execucao' | 'ambiguo'
export interface RouteResult { mode: MessageMode; confidence: 'alta' | 'baixa' }

function normalizeForRouter(text: string): string {
  return text.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[!?.,;:]/g, ' ')
    .replace(/(.)\1{2,}/g, '$1$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeForGreeting(text: string): string {
  return normalizeForRouter(text).replace(/(\w)\1+$/g, '$1')
}

const RE_SAUDA   = /\b(oi|ola|opa|e\s*ai|bom\s*dia|boa\s*tarde|boa\s*noite|tudo\s*bem|tudo\s*bom|obrigad[oa]|valeu|vlw|blz|ok|teste|tchau|ate\s*mais|olá|obrigado|olaa|oii|boa)\b/
const RE_ACAO    = /\b(cri[ae]|cria|adiciona|add|coloca|bota|insere|insira|implementa|implementar|faz|faca|desenvolve|gera|constroi|constrói|muda|mude|altera|altere|troca|troque|substitui|substitua|remove|remov[ae]|apaga|apague|deleta|delete|corrige|corrija|corrigi|ajusta|ajuste|arruma|arrume|conserta|conserte|configura|configure|atualiza|atualize|refatora|refatore|otimiza|otimize|melhora|melhore|aumenta|aumente|diminui|diminua|reduz|reduza|move|mova|reorganiza|reorganize|renomeia|renomeie|integra|integre|conecta|conecte|sincroniza|sincronize|publica|publique|deploy|implanta|implante|testa|teste|valida|valide|continua|continue|prossiga|siga|retome|finalize|repita)\b/
const RE_ANALISE = /\b(analisa|analise|revisa|revise|verifica|verifique|inspeciona|inspecione|investiga|investigue|diagnostica|diagnostique|explica|explique|descreve|descreva|mostra|mostre|lista|liste|mapeia|mapeie|identifica|identifique|confere|confira|checa|cheque|avalia|avalie|compara|compare|resume|resum[ae]|relata|relate|audita|audite)\b/
const RE_RELATO  = /\b(me\s+(?:diga|diz|mostra|mostre|explica|explique|fala|fale|conta|conte|descreve|descreva|lista|liste|aponta|aponte|indica|indique|resume|resumo))\b/
const RE_INTERP  = /\b(o\s*que|oq|como|qual|quais|quanto|quantos|quando|onde|por\s*que|porque|quem)\b[\s\S]{0,200}\b(projeto|app|aplicativo|site|pagina|componente|funcao|codigo|arquivo|tabela|banco|api|rota|tela|modulo|servico|hook|layout|css|typescript|javascript|react|supabase|vercel)\b/i
const RE_INTER   = /\b(o\s*que|oq|como|qual|quais|quanto|quantos|quando|onde|por\s*que|porque|quem)\b/
const RE_SUBST   = /\b(projeto|app|aplicativo|site|pagina|componente|funcao|codigo|arquivo|tabela|banco|api|rota|tela|modulo|servico|hook|layout|estilo|css|typescript|javascript|react|supabase|vercel|botao|menu|formulario|lista|card|modal|header|footer|sidebar|dashboard)\b/
const RE_IMPL    = /\b(quero|preciso|falta|nao\s*abre|nao\s*funciona|nao\s*carrega|tem\s*que|ta\s*errado|esta\s*errado|quebrou|ta\s*quebrado|bug|erro|falha|problema)\b/

export function routeMode(rawText: string): RouteResult {
  const text = normalizeForRouter(rawText)
  const len  = rawText.trim().length
  if (!text) return { mode: 'execucao', confidence: 'alta' }
  if (RE_RELATO.test(text) && !RE_ACAO.test(text)) return { mode: 'analise',  confidence: 'alta' }
  if (RE_ACAO.test(text))                           return { mode: 'execucao', confidence: 'alta' }
  if (RE_ANALISE.test(text))                        return { mode: 'analise',  confidence: 'alta' }
  if (len <= 120 && RE_SAUDA.test(normalizeForGreeting(rawText))) return { mode: 'conversa', confidence: 'alta' }
  if (RE_INTERP.test(text))                         return { mode: 'analise',  confidence: 'baixa' }
  if (len <= 300 && RE_INTER.test(text))            return { mode: 'conversa', confidence: 'baixa' }
  if (RE_IMPL.test(text) && RE_SUBST.test(text))   return { mode: 'execucao', confidence: 'alta' }
  if (len <= 40)                                    return { mode: 'ambiguo',  confidence: 'baixa' }
  return { mode: 'execucao', confidence: 'baixa' }
}
