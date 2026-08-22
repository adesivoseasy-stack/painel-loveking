/**
 * classifier.ts — Roteador de modos (código puro, sem rede, testável localmente)
 *
 * Implementa o método descrito em REPLICAR-ENVIO-POR-ARQUIVO-E-MODOS.md §5
 *
 * Modos:
 *   conversa  — saudação / papo / pergunta geral sem projeto
 *   analise   — ler o projeto, não escrever (read-only)
 *   execucao  — criar, corrigir, alterar, construir
 *   ambiguo   — curto demais / impossível decidir
 */

export type Mode = 'conversa' | 'analise' | 'execucao' | 'ambiguo'
export type Confidence = 'alta' | 'baixa'

export interface ClassifyResult {
  mode: Mode
  confidence: Confidence
}

// ── §5.3 Normalização ──────────────────────────────────────────────────────────
export function normalize(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove diacríticos (§5.3 — número, não literal)
    .toLowerCase()
    .replace(/[!?.,;:]/g, ' ')         // pontuação → espaço
    .replace(/(.)\1{2,}/g, '$1$1')     // 3+ repetições → 2 (§5.3)
    .replace(/\b(oi{2,}|ola{2,}|opa{2,}|ei{2,})\b/g, m => m.slice(0, 2)) // colapsa saudações
    .replace(/\s+/g, ' ')
    .trim()
}

// Colapso de letra dupla no final de palavra (para saudações tipo "vlww")
function normalizeTrailing(word: string): string {
  return word.replace(/(.)\1+$/, '$1')
}

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

// ── §5.4 Vocabulários ─────────────────────────────────────────────────────────

// Saudações / aberturas
const ABERTURAS = new Set([
  'oi','ola','opa','ei','eai','e ai','bom dia','boa tarde','boa noite','hey','hi','hello',
  'obrigado','obrigada','valeu','vlw','grato','grata','agradeco','agradeco muito',
  'tudo bem','tudo bom','td bem','td bom','como vai','como voce vai',
  'ate logo','ate mais','tchau','flw','falou','ate','bye','adeus','boa noite',
  'ok','okay','certo','entendido','entendi','combinado','blz','beleza','perfeito',
  'otimo','excelente','show','top','boa','massa','legal','incrivel','maravilhoso',
  'sim','nao','claro','com certeza','pode ser','tudo certo','tudo ok',
  'please','por favor','pfv','pf','pode','consegue','sera que',
])

// Verbos de ação — qualquer um desqualifica conversa/análise (§5.4 — família de continuação incluída)
const VERBOS_ACAO = new Set([
  // criação/implementação
  'crie','criar','cria','faca','faça','fazer','faz','implemente','implementar','implementa',
  'desenvolva','desenvolver','desenvolve','construa','construir','constroi','monte','montar','monta',
  'gere','gerar','gera','produza','produzir','produz','escreva','escrever','escreve',
  // alteração
  'altere','alterar','altera','mude','mudar','muda','troque','trocar','troca',
  'edite','editar','edita','modifique','modificar','modifica','ajuste','ajustar','ajusta',
  'atualize','atualizar','atualiza','refatore','refatorar','refatora',
  // correção
  'corrija','corrigir','corrige','conserte','consertar','conserta','arrume','arrumar','arruma',
  'resolva','resolver','resolve','corrija','concerta','debug','debugue','debugar',
  // remoção
  'remova','remover','remove','apague','apagar','apaga','delete','deletar','deleta',
  'exclua','excluir','exclui','tire','tirar','tira','limpe','limpar','limpa',
  // adição
  'adicione','adicionar','adiciona','inclua','incluir','inclui','insira','inserir','insere',
  'coloque','colocar','coloca','ponha','por','bote','botar','bota',
  // estilo
  'estilize','estilizar','estiliza','formate','formatar','formata','redesenhe','redesenhar',
  'deixe','deixar','deixa',
  // continuação (§5.4 — família de continuação)
  'continue','continua','continuar','prossiga','prosseguir','prossegue',
  'siga','seguir','segue','retome','retomar','retoma','finalize','finalizar','finaliza',
  'conclua','concluir','conclui','repita','repetir','repete','complete','completar','completa',
  // substituição
  'substitua','substituir','substitui','troca','troque','muda','mude',
  // configuração
  'configure','configurar','configura','habilite','habilitar','habilita',
  'desabilite','desabilitar','desabilita','ative','ativar','ativa',
  'desative','desativar','desativa','ligue','ligar','liga','desligue','desligar','desliga',
  // integração
  'integre','integrar','integra','conecte','conectar','conecta','sincronize','sincronizar',
  // deploy/publicação
  'publique','publicar','publica','suba','subir','sobe','deploy','faça deploy',
])

// Verbos de análise — leitura sem escrita
const VERBOS_ANALISE = new Set([
  'analise','analisar','analisa','revise','revisar','revisa','verifique','verificar','verifica',
  'confira','conferir','confere','inspecione','inspecionar','inspeciona','cheque','checar','checa',
  'veja','ver','ve','olhe','olhar','olha','leia','ler','le',
  'explique','explicar','explica','descreva','descrever','descreve','detalhe','detalhar','detalha',
  'liste','listar','lista','mostre','mostrar','mostra','exiba','exibir','exibe',
  'encontre','encontrar','encontra','localize','localizar','localiza','busque','buscar','busca',
  'identifique','identificar','identifica','mapeie','mapear','mapeia',
  'diagnostique','diagnosticar','diagnostica','investigue','investigar','investiga',
  'entenda','entender','entende','compreenda','compreender','compreende',
  'teste','testar','testa','valide','validar','valida',
  'monitore','monitorar','monitora','acompanhe','acompanhar','acompanha',
  'compare','comparar','compara','avalie','avaliar','avalia','audite','auditar','audita',
  'doc','documente','documentar','documenta',
])

// Pronomes interrogativos e locuções
const INTERROGATIVAS = new Set([
  'o que','oq','oque','como','qual','quais','quanto','quantos','quantas',
  'quando','onde','por que','porque','pq','pra que','para que','pra quê',
  'quem','voce','vc','vcs','voces','tem como','e possivel','é possível','é possível',
  'pode','podem','consegue','conseguem','existe','existem','ha','há',
  'sera','será','seria','poderia','teria','tem','ha como','da pra','da para',
])

// Substantivos de projeto (o que faz uma pergunta ser sobre o projeto)
const SUBSTANTIVOS_PROJETO = new Set([
  // UI
  'pagina','paginas','tela','telas','componente','componentes','botao','botoes','botão','botões',
  'menu','menus','header','footer','sidebar','navbar','modal','popup','dialog','card','cards',
  'formulario','formularios','formulário','formulários','input','inputs','campo','campos',
  'tabela','tabelas','lista','listas','grid','layout','design','estilo','estilos','tema','temas',
  'cor','cores','fonte','fontes','icone','icones','ícone','ícones','imagem','imagens',
  'animacao','animações','transicao','transicoes','responsivo','mobile','desktop',
  // funcionalidades
  'rota','rotas','pagina','navegacao','navegação','link','links','redirecionamento',
  'autenticacao','autenticação','login','logout','cadastro','registro','usuario','usuarios',
  'senha','token','sessao','sessão','permissao','permissões','role','roles',
  'api','endpoint','endpoints','fetch','requisicao','requisições','resposta','respostas',
  'webhook','integracao','integração','supabase','firebase','banco','dados','tabela',
  'query','consulta','filtro','filtros','busca','pesquisa','paginacao','paginação',
  'upload','download','arquivo','arquivos','storage','armazenamento',
  'email','notificacao','notificação','alert','toast','erro','erros','loading',
  'estado','estado','hook','hooks','context','redux','store','props',
  // código/projeto
  'codigo','código','arquivo','arquivos','funcao','função','componente','classe','classe',
  'variavel','variável','constante','import','export','dependencia','dependência',
  'build','deploy','producao','produção','ambiente','config','configuracao','configuração',
  'bug','erro','falha','problema','issue','crash','quebrado','quebrada',
  'performance','lentidao','lentidão','otimizacao','otimização','cache',
  'teste','testes','test','spec','cobertura',
])

// Pedido implícito (§5.4)
const PEDIDO_IMPLICITO = new Set([
  'quero','preciso','necessito','falta','nao abre','não abre','nao funciona','não funciona',
  'tem que','ta errado','está errado','ta quebrado','está quebrado','nao ta','não ta',
  'deveria','deveria ter','devia','precisava','gostaria','seria bom','seria legal',
  'seria otimo','seria ótimo','gostaria que','queria que','precisava que',
])

// ── §5.5 Ordem de classificação ───────────────────────────────────────────────

// Degrau 1: pedido de relato em primeira pessoa (análise)
const RELATO_PRIMEIRA_PESSOA = /\b(me\s+(diga|mostre|mostra|explique|explica|liste|lista|descreva|descreve|encontre|encontra|localize|localiza|identifique|identifica|fala|conta|diz))\b/

// Teto de caracteres por classe
const TETO_SAUDACAO = 120
const TETO_PERGUNTA = 300
const TETO_FRAGMENTO = 40

export function classifyMode(rawText: string): ClassifyResult {
  const text = normalize(rawText)
  const len = text.length
  const wds = words(text)

  // ── Degrau 0: vazio → execução ────────────────────────────────────────────
  if (!text) return { mode: 'execucao', confidence: 'alta' }

  // ── Degrau 1: pedido de relato em 1ª pessoa → análise ────────────────────
  if (RELATO_PRIMEIRA_PESSOA.test(text)) {
    return { mode: 'analise', confidence: 'alta' }
  }

  // ── Degrau 2: verbo de ação → execução ────────────────────────────────────
  // (família de continuação inclusa, ex: "continue", "prossiga")
  for (const w of wds) {
    if (VERBOS_ACAO.has(w) || VERBOS_ACAO.has(normalizeTrailing(w))) {
      return { mode: 'execucao', confidence: 'alta' }
    }
  }
  // bigrams: "faz isso", "faz deploy"
  for (let i = 0; i < wds.length - 1; i++) {
    const bigram = wds[i] + ' ' + wds[i + 1]
    if (VERBOS_ACAO.has(bigram)) return { mode: 'execucao', confidence: 'alta' }
  }

  // ── Degrau 3: verbo de análise → análise ─────────────────────────────────
  for (const w of wds) {
    if (VERBOS_ANALISE.has(w)) {
      // §5.4: "mostre" é ambíguo — resolve por 1ª pessoa (já verificado no degrau 1)
      return { mode: 'analise', confidence: 'alta' }
    }
  }

  // ── Degrau 4: saudação dentro do teto curto → conversa ───────────────────
  if (len <= TETO_SAUDACAO) {
    const firstWord = normalizeTrailing(wds[0] || '')
    if (ABERTURAS.has(firstWord) || ABERTURAS.has(text)) {
      return { mode: 'conversa', confidence: 'alta' }
    }
    // verifica frase inteira de 1-3 palavras como saudação
    if (wds.length <= 3 && ABERTURAS.has(wds.join(' '))) {
      return { mode: 'conversa', confidence: 'alta' }
    }
  }

  // ── Degrau 5: interrogativa COM substantivo de projeto → análise ──────────
  const hasInterrogativa = wds.some(w => INTERROGATIVAS.has(w)) ||
    [...INTERROGATIVAS].some(expr => expr.includes(' ') && text.includes(expr))
  const hasSubstantivoProjeto = wds.some(w => SUBSTANTIVOS_PROJETO.has(w))

  if (hasInterrogativa && len <= TETO_PERGUNTA) {
    if (hasSubstantivoProjeto) return { mode: 'analise', confidence: 'baixa' }
    // ── Degrau 5b: interrogativa SEM substantivo de projeto → conversa ──────
    return { mode: 'conversa', confidence: 'baixa' }
  }

  // ── Degrau 6: pedido implícito E substantivo de projeto → execução ─────────
  const hasPedidoImplicito = wds.some(w => PEDIDO_IMPLICITO.has(w))
  if (hasPedidoImplicito && hasSubstantivoProjeto) {
    return { mode: 'execucao', confidence: 'alta' }
  }

  // ── Degrau 7: fragmento curtíssimo sem sinal → ambíguo ───────────────────
  if (len <= TETO_FRAGMENTO) {
    return { mode: 'ambiguo', confidence: 'baixa' }
  }

  // ── Degrau 8: sobrou → execução (preserva comportamento histórico) ─────────
  return { mode: 'execucao', confidence: 'baixa' }
}
