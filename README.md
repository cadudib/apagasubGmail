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

   `https://avancard.c3n0.com.br/projeto/EXTCHROME/apagasub-V1.15.zip`

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
- Alguns e-mails escondem o descadastro em rodapes, imagens ou paginas externas.
- A varredura trabalha por pagina visivel, nao pela caixa inteira de uma vez.

## Desenvolvimento

Arquivos principais:

- `manifest.json`: configuracao da extensao MV3.
- `src/popup.html`: interface do popup.
- `src/popup.css`: estilos do popup.
- `src/popup.js`: logica do popup.
- `src/content.js`: automacao executada dentro do Gmail.

Validacao rapida:

```bash
node --check src/popup.js
node --check src/content.js
```

## Versao atual

V1.16
