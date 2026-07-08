# Apaga Sub Gmail

Extensao Chrome MV3 para ajudar a encontrar e cancelar inscricoes de newsletters, promocoes e listas diretamente no Gmail aberto no navegador.

Ela nao pede senha, nao usa OAuth e nao exige Google Cloud. A extensao trabalha sobre a interface do Gmail que ja esta logada no Chrome.

## Principais recursos

- Buscas prontas para `Promocoes`, `Newsletters`, `Lojas`, `Cursos`, `Ingles` e ultimos meses.
- Preenchimento automatico da busca do Gmail com termos bons para encontrar mensagens de assinatura.
- Listagem das linhas visiveis do Gmail.
- Varredura de 10, 25 ou 50 e-mails visiveis por pagina.
- Deteccao do botao nativo `Cancelar inscricao` que aparece na lista ao passar o mouse.
- Fallback para abrir o e-mail e procurar links ou botoes de descadastro dentro da mensagem.
- Tentativa de confirmacao automatica no pop-up do Gmail.
- Selecao individual clicando na linha do resultado ou no checkbox.
- Botao `Filtrar remetente`, que busca todos os e-mails do remetente aberto usando `from:`.
- Botao `Proxima pagina`, para continuar a varredura em outras paginas do Gmail.
- Painel de debug com progresso e eventos recentes da varredura.

## Instalacao

1. Baixe a versao mais recente:

   `https://avancard.c3n0.com.br/projeto/EXTCHROME/apagasub-V1.48.zip`

2. Extraia o arquivo ZIP.

3. Abra no Chrome:

   `chrome://extensions`

4. Ative `Modo do desenvolvedor`.

5. Clique em `Carregar sem compactacao`.

6. Selecione a pasta extraida que contem o arquivo `manifest.json`.

7. Abra ou recarregue o Gmail:

   `https://mail.google.com`

Sempre que atualizar a extensao, remova a versao antiga, instale a nova e recarregue a aba do Gmail.

## Como usar para cancelar inscricoes

1. Abra o Gmail.

2. Entre em `Promocoes` ou use uma busca pronta da extensao.

3. Abra a extensao `Apaga Sub`.

4. Escolha quantos e-mails quer verificar: `10`, `25` ou `50`.

5. Clique em `Varrer pagina`.

6. Aguarde a extensao verificar os e-mails visiveis.

7. Os itens encontrados como acionaveis aparecem como prontos para descadastro.

8. Marque os itens que deseja cancelar.

9. Clique em `Sair das selecionadas`.

10. Se o Gmail ou o site externo pedir confirmacao manual, confirme na tela aberta.

## Botoes da extensao

### Buscas prontas

Preenchem a busca do Gmail e iniciam a varredura:

- `Promocoes`
- `Newsletters`
- `Ultimos 6 meses`
- `Lojas`
- `Cursos`
- `Ingles`

### Ver linhas

Lista os e-mails visiveis na tela atual. Esse botao nao procura descadastro. Ele serve para confirmar que a extensao esta lendo a lista correta.

### Varrer pagina

Verifica os e-mails visiveis na pagina atual. Primeiro tenta achar o botao `Cancelar inscricao` que aparece na propria lista do Gmail ao passar o mouse. Se nao encontrar, abre o e-mail e procura links ou botoes de descadastro dentro da mensagem.

### Filtrar remetente

Pega o remetente do e-mail aberto e faz uma busca do tipo:

```text
from:email@dominio.com
```

Use isso para apagar em lote todos os e-mails de um mesmo remetente pelo proprio Gmail.

### Proxima pagina

Tenta clicar no botao de proxima pagina do Gmail para continuar a varredura em outros resultados.

## Permissoes

- `https://mail.google.com/*`: permite ler a tela do Gmail e acionar botoes visiveis.
- `tabs`: permite confirmar que a aba atual e o Gmail e abrir paginas externas de descadastro.
- `scripting`: permite ativar o script da extensao na aba do Gmail quando voce clica nos botoes.

## Limitacoes

Esta extensao nao usa a API oficial do Gmail. Por isso:

- Ela depende da interface visual do Gmail.
- Mudancas no layout do Gmail podem exigir ajustes.
- Alguns descadastros abrem paginas externas e precisam de confirmacao manual.
- Links externos de descadastro sao abertos somente quando usam `http:` ou `https:`.
- O modo automatico de limpeza pede confirmacao antes de enviar mensagens para a lixeira.
- Alguns e-mails escondem o descadastro em rodapes, imagens ou paginas externas.
- A varredura trabalha por pagina visivel, nao pela caixa inteira de uma vez.

## Desenvolvimento

Arquivos principais:

- `manifest.json`: configuracao da extensao MV3.
- `src/popup.html`: interface do popup.
- `src/popup.css`: estilos do popup.
- `src/popup.js`: logica do popup.
- `src/content.js`: automacao executada dentro do Gmail.

Depois de alterar `src/popup.js` ou `src/content.js`, rode a validacao rapida:

```bash
node --check src/popup.js
node --check src/content.js
```

Para gerar o ZIP de instalacao com o `manifest.json` na raiz:

```bash
scripts/package.sh
```

## Roteiro de teste seguro

1. Abra um e-mail de remetente descartavel no Gmail.
2. Clique em `Filtrar remetente`.
3. Clique em `Testar paginacao`.
4. Clique em `Simular apagar`.
5. Clique em `Apagar pag. atual`.
6. Use `Abrir lixeira filtrada` para confirmar o resultado.
7. So depois aumente o `Limite` ou use `Apagar lote`.

## Matriz de acoes

| Acao | Apaga? | Risco | Pre-requisito |
| --- | --- | --- | --- |
| Filtrar remetente | Nao | Baixo | E-mail aberto ou linha visivel |
| Testar paginacao | Nao | Baixo | Resultado de busca do Gmail |
| Simular apagar | Nao | Baixo | Remetente com e-mail claro |
| Quarentena | Nao | Medio | Remetente com e-mail claro |
| Apagar pag. atual | Sim | Medio | Simulacao recomendada |
| Filtrar e apagar | Sim | Alto | Limite revisado |
| Apagar dominio | Sim | Alto | Confirmar dominio |
| Apagar lote | Sim | Alto | Itens selecionados e bloqueios revisados |

## Versao atual

V1.48

## Changelog

### V1.48

- Adiciona velocidade `Turbo seguro` para reduzir pausas mantendo checagem do carregamento do Gmail.
- Troca mais esperas fixas por espera inteligente quando o Gmail termina de carregar.
- Bloqueia clique duplo/reentrada enquanto uma acao ja esta em andamento.
- Pula alvo vazio automaticamente quando a busca do remetente nao encontra mensagens.
- Mostra progresso com pagina e estimativa de mensagens enviadas para a lixeira.

### V1.47

- Em modo rapido, reduz logs repetitivos para diminuir overhead no popup.
- Usa pausa adaptativa entre paginas durante a limpeza.
- Usa caminho mais direto apos exclusao quando a lista fica vazia rapidamente.
- Mantem dry-run obrigatorio apenas quando a opcao estiver ativada.
- Reduz o limite padrao de limpeza para 5 paginas.

### V1.46

- Adiciona modo de velocidade `Seguro`, `Normal` e `Rapido`.
- Troca esperas fixas principais por atrasos ajustados pelo perfil de velocidade.
- Adiciona `Varrer so a lista visivel` para varredura mais rapida sem abrir e-mails.
- Adiciona cache de remetentes verificados na sessao para pular repetidos.
- Altera o padrao de varredura para 10 e-mails.

### V1.45

- Salva automaticamente o limite padrao escolhido.
- Adiciona IDs de execucao para limpezas e lotes.
- Adiciona opcao de exigir simulacao recente antes de apagar.
- Salva relatorio pos-limpeza por execucao.
- Adiciona `docs/ARCHITECTURE.md` com fluxo, mensagens e riscos.

### V1.44

- Adiciona roteiro de teste seguro e matriz de acoes no README.
- Reduz ruido visual com `Mais acoes` para controles avancados.
- Persiste aba, modo e limite de paginas escolhidos.
- Itens bloqueados/protegidos agora sao desmarcados e ignorados, sem travar a acao dos demais.
- Mantem o fluxo de lote seguindo com os remetentes permitidos.

### V1.43

- Salva plano de auditoria antes de ações destrutivas.
- Adiciona `Backup JSON` completo com histórico, configurações, auditorias e debug.
- Valida seleção ativa antes de clicar na lixeira.
- Reforça o diagnóstico como teste interno de seletores com PASS/FAIL.
- Organiza `popup.js` e `content.js` com seções internas para manutenção.

### V1.42

- Organiza ações por abas: Buscar, Limpar, Lote, Config e Debug.
- Adiciona modo `Simples`/`Avançado` para reduzir ruído visual.
- Adiciona checklist guiado do fluxo seguro.
- Salva e mostra a última operação do popup.
- Melhora diagnóstico de paginação com rótulo e estado do botão detectado.

### V1.41

- Adiciona importação/exportação de configurações.
- Adiciona palavras-chave protegidas editáveis para evitar limpezas arriscadas.
- Adiciona `Quarentena`, que filtra e seleciona sem apagar.
- Adiciona `Diagnóstico` de seletores do Gmail.
- Adiciona ajuda curta com fluxo seguro recomendado.

### V1.40

- Salva relatório persistente dos testes/simulações de paginação no histórico.
- Adiciona `Confirmar cada página antes de apagar`.
- Mostra prévia detalhada antes de executar lote.
- Mostra fila visual simples durante lote.
- Adiciona exportação CSV do histórico de limpezas.

### V1.39

- Adiciona configurações no popup com domínios bloqueados editáveis.
- Adiciona `Abrir lixeira filtrada` como undo assistido após uma limpeza.
- Registra query, limite e motivo de parada no histórico.
- Adiciona `Simular lote` e `Apagar lote` para remetentes selecionados na lista.

### V1.38

- Adiciona `Testar paginação` sem apagar mensagens.
- Torna `Simular apagar` paginado para estimar páginas e mensagens antes da exclusão.
- Adiciona confirmação com faixa/limite de páginas antes de apagar.
- Adiciona `Apagar pág. atual` para executar limpeza limitada a uma página.
- Registra no debug o relatório de paginação página por página.

### V1.37

- Adiciona `Apagar domínio` para limpar por domínio do remetente aberto com confirmação forte.
- Adiciona histórico visual de limpezas recentes no popup.
- Adiciona `Exportar log` com resumo, histórico e debug.
- Mostra progresso verificável de paginação durante a limpeza.
- Adiciona limite configurável de páginas por remetente/domínio.

### V1.36

- Adiciona `Simular apagar` para filtrar remetente e estimar mensagens/paginação sem excluir.
- Mostra progresso da limpeza no popup durante seleção, exclusão e paginação.
- Melhora o resumo final da limpeza automática.
- Adiciona botão `Parar` para interromper loops de limpeza.
- Adiciona bloqueio de segurança para remetentes/domínios sensíveis antes de ações destrutivas.

### V1.35

- Faz a limpeza automática continuar por páginas do mesmo remetente até não haver mais mensagens visíveis ou próxima página.
- Adiciona limite de segurança de 20 páginas por remetente e para se a lista não mudar após clicar na lixeira.

### V1.34

- Amplia a detecção do botão de excluir do Gmail com seletores específicos como `act="10"`, `Delete`, `Excluir` e `Mover para a lixeira`.
- Adiciona debug dos controles superiores quando a lixeira não é encontrada.

### V1.33

- Se o seletor superior do Gmail abrir o menu da seta, escolhe `Todos`/`All` antes de tentar excluir.
- Só continua para exclusão quando encontra o botão de lixeira na barra de ações.

### V1.32

- Restringe o clique de apagar ao botão da barra de ações do Gmail, evitando abrir a pasta `Lixeira` da lateral.
- Restringe a seleção ao checkbox superior da lista antes das mensagens visíveis.

### V1.31

- Adiciona o botão `Filtrar e apagar` para buscar o remetente do e-mail aberto e enviar automaticamente as mensagens visíveis desse remetente para a lixeira.
- Exige e-mail claro do remetente antes da limpeza automática direta.

### V1.30

- Troca o disparo da busca do Gmail para uma ação interna sem `form.submit()`, evitando refresh da página.
- Adiciona retry automático da busca para cobrir o caso em que o primeiro clique apenas foca/preenche e o segundo efetivamente pesquisa.

### V1.29

- Corrige `Filtrar remetente` aberto dentro de um e-mail para navegar direto para `#search/from:...`, evitando voltar para a caixa de entrada sem buscar.

### V1.28

- Força a busca `from:` por URL em cada remetente antes de limpar, mesmo quando o campo de busca aceita o texto.
- Espera a lista do Gmail carregar antes de selecionar mensagens e espera a barra de ações antes de clicar na lixeira.
- Mantém o loop de limpeza remetente por remetente até terminar todos os itens selecionados.

### V1.27

- Corrige falha do modo `Auto: enviar para lixeira` quando a busca `from:` mudava a tela do Gmail antes da resposta do content script.
- Separa descadastro e limpeza em comandos curtos para evitar canal de mensagem fechado durante navegacao do Gmail.

### V1.26

- Adiciona confirmacao explicita antes do modo automatico enviar e-mails para a lixeira.
- Mostra preview do modo de limpeza e quantidade de remetentes detectados.
- Registra remetente, modo de limpeza e dominio externo no historico local.
- Retorna resultado detalhado da limpeza por remetente para facilitar debug.

### V1.25

- Fortalece a execucao da busca `from:` com Enter completo, submit do formulario e navegacao direta por URL.

### V1.24

- Corrige limpeza por remetente para forcar navegacao na busca `from:`.
- Adiciona fallback por URL do Gmail quando o Enter no campo de busca nao dispara.

### V1.23

- Adiciona modo de limpeza apos descadastro: seguro, semi-automatico, automatico ou desligado.
- Usa busca `from:remetente` para limpar e-mails antigos daquele remetente.

### V1.22

- Deduplica itens acionaveis por remetente/lista na visualizacao.
- Marca itens que ja aparecem no historico local como `ja tentado`.

### V1.21

- Adiciona resumo da ultima execucao no popup.
- Salva historico local dos descadastros executados.
- Adiciona permissao `storage` para manter o historico no Chrome.

### V1.20

- Torna o clique de confirmacao mais restrito a botoes reais do modal.
- Evita clicar no titulo/texto `Cancelar inscricao` em vez do botao final.
- Adiciona clique por coordenada no centro do controle para modais do Gmail.

### V1.19

- Adiciona estado visual por item durante descadastro.
- Adiciona pausa entre descadastros para reduzir travamentos no Gmail.
- Adiciona botao para copiar o log de debug.

### V1.18

- Adiciona debug dos botoes visiveis no modal de confirmacao do Gmail.
- Ajuda a diagnosticar quando a extensao abre o modal, mas nao clica no botao final automaticamente.

### V1.17

- Melhora a confirmacao automatica do modal `Cancelar inscricao` do Gmail.
- Prioriza botoes dentro de dialogos/modais.

### V1.16

- Adiciona painel de debug no popup.
- Registra progresso da varredura e eventos de descadastro.

### V1.15

- Amplia textos reconhecidos para confirmacao automatica.

### V1.14

- Melhora retorno para a lista apos abrir um e-mail durante a varredura.

### V1.13

- Adiciona seletor de varredura para 10, 25 ou 50 e-mails.
- Adiciona botao de proxima pagina.
