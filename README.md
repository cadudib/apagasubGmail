# Apaga Sub V1.15

Extensão Chrome MV3 para ajudar a sair de newsletters/listas usando o Gmail aberto.

Ela não pede senha e não exige Google Cloud/OAuth. A extensão roda dentro da aba do Gmail que você já abriu no Chrome.

## O que ela faz

- Lê remetentes visíveis na lista atual do Gmail.
- Detecta links e botões de descadastro visíveis em mensagens abertas.
- Tem buscas prontas para promoções/newsletters.
- Preenche o campo de busca do Gmail com termos bons para achar assinaturas.
- Varre a página atual abrindo e-mails visíveis um por um para procurar descadastro.
- Ao clicar em uma busca pronta, a varredura começa automaticamente.
- Você pode marcar/desmarcar clicando na linha inteira do resultado.
- O botão "Filtrar remetente" pega o remetente do e-mail aberto e busca todos os e-mails iguais com `from:`.
- A varredura prioriza o botão nativo "Cancelar inscrição" do próprio Gmail.
- Ao executar, a extensão reabre o e-mail correto e tenta confirmar o pop-up do Gmail.
- A varredura tenta primeiro o botão "Cancelar inscrição" que aparece na lista ao passar o mouse.
- Corrige repetição do primeiro resultado usando chave única por linha e assunto.
- Corrige o "Listar tela" para listar apenas linhas reais do Gmail quando estiver na lista.
- "Ver linhas" apenas mostra os e-mails. "Varrer página" é quem procura descadastro.
- Você pode escolher varrer 10, 25 ou 50 e-mails visíveis.
- O botão "Próxima página" avança a página atual do Gmail.
- A varredura tem retorno mais robusto para não ficar presa dentro de um e-mail.
- A confirmação automática do Gmail reconhece mais variações de texto.
- Permite marcar os itens encontrados.
- Ao executar, abre links de descadastro em nova aba ou clica no botão visível.
- Para itens da lista, abre a mensagem e tenta encontrar um descadastro visível.

## Como usar

1. Abra `chrome://extensions`.
2. Ative "Modo do desenvolvedor".
3. Clique em "Carregar sem compactação".
4. Selecione esta pasta.
5. Abra o Gmail já logado.
6. Abra uma newsletter ou deixe uma lista de e-mails visível.
7. Clique na extensão e escolha uma busca pronta, como "Promoções" ou "Lojas".
8. A extensão preenche a busca do Gmail, pesquisa e inicia a varredura.
9. Marque os itens clicando na linha ou no checkbox.
10. Clique em "Sair das selecionadas".

Para apagar vários e-mails do mesmo remetente, abra um e-mail desse remetente e clique em "Filtrar remetente". O Gmail vai mostrar todos os e-mails dele para você selecionar e apagar em lote.

Ao atualizar a extensão, recarregue a aba do Gmail antes de testar a nova versão.

## Permissões

- `https://mail.google.com/*`: usada para ler a tela do Gmail e acionar links/botões visíveis.
- `tabs`: usada para confirmar que a aba atual é o Gmail e abrir páginas de descadastro.
- `scripting`: usada para ativar a extensão na aba do Gmail quando você clica em "Listar".

## Limite importante

Sem a API do Gmail, a extensão não consegue ler cabeçalhos internos como `List-Unsubscribe`. Ela depende do que aparece na tela. Se o Gmail mudar a interface, ou se a newsletter esconder o descadastro em uma página externa, pode ser necessário confirmar manualmente.
