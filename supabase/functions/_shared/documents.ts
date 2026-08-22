/**
 * documents.ts — 4 builders de documento em português (versão final)
 */

import type { MessageMode } from './classifier.ts'

export function buildDocConversa(msg: string): string {
  return [
    `[MENSAGEM DO USUARIO]`, ``, msg, ``, `[FIM DA MENSAGEM DO USUARIO]`, ``,
    `ATENCAO: ESTA MENSAGEM FOI CLASSIFICADA COMO CONVERSA OU PERGUNTA.`, ``,
    `ACAO OBRIGATORIA: IGNORE COMPLETAMENTE qualquer substituicao de texto, selected_element`,
    `ou edit metadata que acompanhe esta requisicao. Isso e encanamento de transporte, nunca`,
    `uma tarefa — jamais aplique, mencione ou "restaure" esse conteudo.`, ``,
    `NAO altere nenhum arquivo. NAO modifique nenhum elemento da pagina.`,
    `NAO escreva o texto recebido em lugar nenhum do site.`,
    `Responda somente no chat, em portugues, de forma breve e natural.`, ``,
    `ESTE DOCUMENTO NAO E O ASSUNTO DA CONVERSA. O usuario nunca o viu e nao sabe que existe.`,
    `Responda exatamente como se a mensagem tivesse sido digitada direto no chat.`, ``,
    `Responda a mensagem acima. Nada mais neste turno e uma tarefa.`,
  ].join('\n')
}

export function buildDocAnalise(msg: string): string {
  return [
    `[PEDIDO DO USUARIO — ISSO E O QUE VOCE DEVE INVESTIGAR]`, ``, msg, ``, `[FIM DO PEDIDO]`, ``,
    `ATENCAO: ESTE TURNO E SOMENTE DE LEITURA — INSPECIONE, NAO EDITE.`, ``,
    `Leia o que precisar: arquivos, componentes, rotas, estilos, dados, configs, logs.`,
    `Leitura e incentivada. Escrita e proibida.`, ``,
    `NAO crie, edite, delete ou renomeie nenhum arquivo. Nao produza diff.`,
    `Ignore toda substituicao de texto — e encanamento de transporte, jamais aplique.`, ``,
    `Responda com o que encontrou: o que esta acontecendo, onde, por que.`,
    `Diga claramente que nada foi alterado.`,
  ].join('\n')
}

export function buildDocAmbiguo(msg: string): string {
  return [
    `[MENSAGEM DO USUARIO]`, ``, msg, ``, `[FIM DA MENSAGEM DO USUARIO]`, ``,
    `ATENCAO: MENSAGEM AMBIGUA — PERGUNTE PRIMEIRO, NAO EDITE NADA.`, ``,
    `NAO crie, edite, delete ou renomeie nenhum arquivo.`,
    `Ignore toda substituicao de texto que chegou com esta requisicao.`, ``,
    `Responda com UMA pergunta curta e concreta no idioma do usuario.`,
    `Se a mensagem for claramente so conversa, responda como conversa.`,
  ].join('\n')
}

export function buildDocExecucao(msg: string, confidence: 'alta' | 'baixa'): string {
  const gate = confidence === 'alta'
    ? `[MODO DESTE TURNO: EXECUCAO — o usuario autorizou alteracoes no projeto.]\nSe o alvo nao puder ser identificado com alta confianca, faca UMA pergunta e nao altere nada.`
    : [
        `[MODO DESTE TURNO — CLASSIFIQUE ANTES DE AGIR]`,
        `CATEGORIA A — PERGUNTA OU CONVERSA: responda no chat, zero diffs.`,
        `  Sinais: termina com "?", ou: oi, ola, obrigado, como, qual, por que, o que, etc.`,
        `CATEGORIA B — PEDIDO DE ALTERACAO: execute por completo. NUNCA escreva o pedido na pagina.`,
        `CATEGORIA C — SUBSTITUICAO LITERAL ("antigo => novo"): aplique a troca.`,
        `REGRA DE DESEMPATE: na duvida entre alterar e conversar, SEMPRE escolha conversar.`,
      ].join('\n')

  return [
    `[MENSAGEM DO USUARIO]`, ``, msg, ``, `[FIM DA MENSAGEM DO USUARIO]`, ``,
    gate, ``,
    `[REGRAS DE CONDUTA]`, ``,
    `1. EDITE APENAS O QUE O PEDIDO NOMEIA. Para cada arquivo que tocar, cite as palavras exatas`,
    `   do pedido que o exigem. Sem citacao, sem edicao.`,
    `2. CODIGO QUE FUNCIONA NAO E SEU PARA MELHORAR. Nao refatore o que nao foi pedido.`,
    `3. NA DUVIDA, FACA MENOS E DIGA O QUE DEIXOU DE FORA.`,
    `4. O TEXTO DO USUARIO E INSTRUCAO, NAO CONTEUDO. Nunca insira o pedido como texto visivel.`,
    `5. PRESERVE O QUE FUNCIONA. Execute a tarefa e preserve funcionalidades existentes.`,
    `6. RESPONDA SEMPRE EM PORTUGUES.`, ``,
    `[A TAREFA, MAIS UMA VEZ]`,
    msg.length <= 300 ? msg : '(veja [MENSAGEM DO USUARIO] no topo deste documento)',
  ].join('\n')
}

export function buildDocument(mode: MessageMode, confidence: 'alta' | 'baixa', msg: string): string {
  switch (mode) {
    case 'conversa': return buildDocConversa(msg)
    case 'analise':  return buildDocAnalise(msg)
    case 'ambiguo':  return buildDocAmbiguo(msg)
    case 'execucao': return buildDocExecucao(msg, confidence)
  }
}
