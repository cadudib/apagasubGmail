<div align="center">

# Apaga Sub Gmail

**Encontre newsletters, cancele inscrições e limpe mensagens antigas sem sair do Gmail.**

[![Versão](https://img.shields.io/badge/versao-1.50-0b57d0?style=flat-square)](https://github.com/cadudib/apagasubGmail)
[![Chrome](https://img.shields.io/badge/Chrome-Manifest_V3-34a853?style=flat-square&logo=googlechrome&logoColor=white)](https://www.google.com/chrome/)
[![JavaScript](https://img.shields.io/badge/JavaScript-sem_dependencias-f7df1e?style=flat-square&logo=javascript&logoColor=111)](https://github.com/cadudib/apagasubGmail)

[**Baixar a extensão pelo GitHub**](https://github.com/cadudib/apagasubGmail/archive/refs/heads/main.zip)

</div>

---

O **Apaga Sub Gmail** é uma extensão para Google Chrome que ajuda a localizar newsletters, promoções e listas de e-mail. Ela usa o Gmail que já está aberto no navegador para encontrar opções de descadastro, filtrar remetentes e, quando autorizado, enviar mensagens antigas para a lixeira.

Não é necessário informar sua senha, configurar OAuth ou criar um projeto no Google Cloud.

> [!IMPORTANT]
> A extensão ainda não está publicada na Chrome Web Store. Por isso, a instalação é feita manualmente a partir dos arquivos deste repositório.

## Recursos

- Buscas prontas para promoções, newsletters, lojas, cursos e mensagens em inglês.
- Detecção do botão nativo **Cancelar inscrição** e de links dentro da mensagem.
- Filtro de todas as mensagens de um remetente usando a busca `from:` do Gmail.
- Varredura de 10, 25 ou 50 mensagens visíveis por página.
- Simulação antes de excluir, quarentena e confirmação por página.
- Limpeza individual ou em lote com limite configuravel de páginas.
- Proteção para domínios e palavras-chave sensíveis.
- Histórico local, relatório CSV, backup JSON e painel de diagnóstico.
- Modos de velocidade Seguro, Normal, Rápido e Turbo seguro.

## Download e instalação

### 1. Baixe pelo GitHub

Clique no botão abaixo para baixar a versão atual em formato ZIP:

**[Download: Apaga Sub Gmail](https://github.com/cadudib/apagasubGmail/archive/refs/heads/main.zip)**

Outra opção é abrir a página do repositório, clicar no botão verde **Code** e escolher **Download ZIP**.

### 2. Extraia o arquivo

Abra a pasta de downloads e extraia o arquivo `apagasubGmail-main.zip`.

Ao terminar, você terá uma pasta chamada `apagasubGmail-main`. O arquivo `manifest.json` deve estar dentro dela.

### 3. Abra as extensões do Chrome

Digite o endereço abaixo na barra do Chrome e pressione Enter:

```text
chrome://extensions
```

### 4. Ative o modo do desenvolvedor

No canto superior direito da página, ative a opção **Modo do desenvolvedor**.

### 5. Carregue a extensão

1. Clique em **Carregar sem compactação**.
2. Selecione a pasta `apagasubGmail-main` que foi extraída.
3. Confirme que o cartão **Apaga Sub V1.50** apareceu na lista de extensões.

> [!TIP]
> No menu de extensões do Chrome, clique no ícone de alfinete ao lado de **Apaga Sub** para deixá-la sempre visivel na barra do navegador.

### 6. Abra o Gmail

Acesse [mail.google.com](https://mail.google.com/), entre na sua conta normalmente e atualize a página. Depois, clique no ícone do **Apaga Sub**.

## Como usar

### Cancelar newsletters

1. Abra o Gmail e clique no **Apaga Sub**.
2. Na aba **Buscar**, escolha uma busca pronta, como **Promoções** ou **Newsletters**.
3. Escolha quantas mensagens deseja analisar: 10, 25 ou 50.
4. Clique em **Varrer página**.
5. Revise os remetentes encontrados e marque somente os desejados.
6. Clique em **Sair das selecionadas**.
7. Confirme manualmente caso o Gmail ou o site do remetente abra uma tela adicional.

### Limpar mensagens antigas com segurança

Use este fluxo antes de executar uma exclusão maior:

1. **Filtrar remetente** para conferir quais mensagens serão afetadas.
2. **Testar paginação** para verificar quantas páginas existem, sem apagar nada.
3. **Simular apagar** para gerar uma estimativa da operação.
4. **Apagar pag. atual** para testar a limpeza em uma única página.
5. Aumentar o limite somente depois de conferir o resultado.

As mensagens são enviadas para a lixeira do Gmail, de onde ainda podem ser recuperadas durante o período definido pelo Google.

## Modos de limpeza

| Modo | O que acontece | Nível de cuidado |
| --- | --- | --- |
| Seguro | Apenas aplica o filtro do remetente | Baixo |
| Semi | Filtra e seleciona as mensagens visíveis | Médio |
| Automático | Filtra e envia mensagens para a lixeira | Alto |
| Desligado | Não executa limpeza depois do descadastro | Baixo |

Para os primeiros testes, mantenha o modo **Seguro** e a opção **Exigir simulação recente antes de apagar** ativada.

## Atualização

Como a extensão é instalada manualmente, o Chrome não a atualiza sozinho.

1. Baixe novamente o [ZIP do GitHub](https://github.com/cadudib/apagasubGmail/archive/refs/heads/main.zip).
2. Extraia o novo arquivo em uma pasta.
3. Abra `chrome://extensions`.
4. Remova a versão antiga do **Apaga Sub**.
5. Clique em **Carregar sem compactação** e selecione a nova pasta.
6. Atualize a aba do Gmail.

## Privacidade e permissões

O Apaga Sub funciona localmente no Chrome e não solicita sua senha do Google.

| Permissão | Por que é usada |
| --- | --- |
| `mail.google.com` | Ler os elementos visíveis do Gmail e acionar os controles solicitados pelo usuário |
| `tabs` | Confirmar que a aba atual e o Gmail e abrir páginas externas de descadastro |
| `scripting` | Executar a automação na aba do Gmail |
| `storage` | Guardar configurações, histórico, simulacoes e relatórios no navegador |

> [!WARNING]
> Os modos automáticos podem enviar várias mensagens para a lixeira. Confira o remetente, execute a simulação e use um limite pequeno nas primeiras operacoes.

## Limitações

- A extensão depende da interface visual do Gmail; alterações feitas pelo Google podem exigir uma nova versão.
- Alguns remetentes exigem confirmação em uma página externa.
- Certos links de descadastro ficam escondidos em imagens ou rodapés e podem não ser detectados.
- A varredura trabalha com as mensagens carregadas na página atual, não com toda a caixa de entrada ao mesmo tempo.
- Links externos somente são abertos quando usam `http:` ou `https:`.

## Solução de problemas

**A extensão não aparece no Chrome**  
Confirme que selecionou a pasta que contém o arquivo `manifest.json`, e não o arquivo ZIP.

**Os botões não encontram o Gmail**  
Atualize a aba do Gmail depois de instalar ou atualizar a extensão.

**A interface do Gmail não foi reconhecida**  
Abra a aba **Debug**, execute **Diagnóstico** e confira quais controles foram detectados.

**O Chrome mostra um aviso sobre o modo do desenvolvedor**  
Esse aviso é esperado para extensões instaladas manualmente e fora da Chrome Web Store.

## Desenvolvimento

O projeto usa JavaScript puro e Chrome Extension Manifest V3, sem etapa de compilacao.

```text
apagasubGmail/
|-- manifest.json       # Configuração da extensão
|-- src/
|   |-- popup.html      # Interface
|   |-- popup.css       # Estilos
|   |-- popup.js        # Lógica do popup
|   `-- content.js      # Integração com o Gmail
|-- docs/
|   `-- ARCHITECTURE.md
`-- scripts/
    `-- package.sh
```

Validação rápida dos scripts:

```bash
node --check src/popup.js
node --check src/content.js
```

Geração do pacote ZIP:

```bash
scripts/package.sh
```

Mais detalhes técnicos estão em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Versão atual

### V1.50

- Substitui alertas e confirmações nativas do popup por uma confirmação interna acessível.
- Mostra claramente os remetentes, limites e bloqueios antes de ações destrutivas.
- Mantém a confirmação por página diretamente no Gmail como proteção adicional.

### V1.49

- Melhora a hierarquia visual para diferenciar ações seguras, primárias e destrutivas.
- Adiciona foco visível, feedback de clique e suporte a redução de movimento.
- Remove um trecho inalcançável da navegação entre páginas do Gmail.

### V1.48

- Adiciona a velocidade **Turbo seguro** com esperas menores e verificacao do carregamento do Gmail.
- Impede clique duplo e execuções simultaneas da mesma ação.
- Pula automaticamente remetentes cuja busca não retorna mensagens.
- Exibe página atual e estimativa de mensagens enviadas para a lixeira.

Consulte o [histórico de commits](https://github.com/cadudib/apagasubGmail/commits/main/) para acompanhar as alterações anteriores.

---

<div align="center">

Encontrou um problema? [Abra uma issue](https://github.com/cadudib/apagasubGmail/issues/new).

</div>
