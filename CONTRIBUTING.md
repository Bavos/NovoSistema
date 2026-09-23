# Guia de Contribuição — Sistema de Gestão Vallidare

Agradecemos o seu empenho em manter o **Sistema de Gestão Vallidare** robusto, escalável e em estrita conformidade com as diretrizes de privacidade e boas práticas de engenharia de software.

Este documento estabelece as diretrizes de versionamento, fluxo de branches no GitHub, padronização de commits e regras obrigatórias de compilação antes de qualquer entrega ou deploy.

---

## 🌿 Padronização de Branches

Adotamos um modelo derivado do *Git Flow* simplificado. Todo desenvolvimento deve ocorrer a partir de branches bem identificadas:

| Tipo de Branch | Padrão de Nomenclatura | Finalidade |
| :--- | :--- | :--- |
| **Produção** | `main` | Código estável em produção. Apenas aceita merges via Pull Request aprovado. |
| **Desenvolvimento** | `develop` | Branch de integração de novas funcionalidades. |
| **Nova Funcionalidade** | `feat/nome-da-feature` | Desenvolvimento de novas telas, fluxos ou integrações. |
| **Correção de Bug** | `fix/descricao-do-bug` | Correção de comportamento inesperado ou erro de cálculo. |
| **Correção Crítica** | `hotfix/incidente-producao` | Correção urgente criada diretamente da `main`. |
| **Refatoração** | `refactor/modulo-alvo` | Melhoria de código sem alteração de comportamento externo. |
| **Segurança & LGPD** | `security/adequacao-lgpd` | Adequação de dados sensíveis, sanitização ou permissões. |

### Exemplos:
- `feat/analise-operacional-gemini`
- `fix/calculo-dias-semana-agosto`
- `refactor/desanonimizacao-cliente`
- `security/restricao-secret-manager`

---

## 💬 Padronização de Mensagens de Commit

Utilizamos o padrão **[Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/)**. Suas mensagens de commit devem ser claras, em português ou inglês consistente, e seguir a seguinte estrutura:

```
<tipo>(<escopo opcional>): <descrição sucinta em tom imperativo>

[corpo opcional explicando o contexto e o porquê da mudança]
```

### Tipos Permitidos:
- **`feat`**: Nova funcionalidade no sistema (ex.: `feat(ia): implementar desanonimização reversível no cliente`).
- **`fix`**: Correção de bug ou regressão (ex.: `fix(escalas): corrigir ordenação decrescente de chaves de pacientes`).
- **`security`**: Atualizações de segurança, LGPD e sanitização de dados.
- **`refactor`**: Mudanças de código que não corrigem bug nem adicionam recurso.
- **`perf`**: Alteração que melhora o desempenho de renderização ou consulta.
- **`docs`**: Atualização ou inclusão de documentações (`README`, `CHANGELOG`, etc.).
- **`chore`**: Atualizações de dependências, configurações do Vite ou rotinas de CI/CD.

---

## 🛡️ Regras de Ouro: Segurança e LGPD

1. **Nunca commite chaves de API, certificados ou segredos**:
   - Arquivos `.env`, chaves privadas, certificados `.crt` / `.key` do Banco Inter ou credenciais do Firebase jamais devem ser adicionados ao repositório.
   - Utilize exclusivamente o **Google Cloud Secret Manager** para credenciais de Cloud Functions.
2. **Privacidade e Pseudonimização Obrigatória**:
   - Qualquer comunicação que envolva serviços de Inteligência Artificial deve submeter os dados previamente ao processo de **pseudonimização reversível no cliente**.
   - A restauração de nomes reais deve sempre ser executada na máquina local do operador após o retorno da resposta.
   - Nunca persista conversas analíticas ou logs com dados pessoais no Firestore ou Cloud Logging.

---

## 🚦 Checklist e Compilação Obrigatória Antes do Deploy

Antes de abrir um Pull Request ou acionar um deploy no Firebase Hosting / Cloud Functions, execute **obrigatoriamente** o checklist a seguir no seu ambiente local:

### 1. Verificação de Tipagem TypeScript (Frontend)
Nenhum erro de tipo é tolerado no repositório:
```bash
npx tsc --noEmit
```
*Critério de aprovação: O comando deve encerrar com código de saída 0 sem nenhuma linha de erro.*

### 2. Compilação do Bundle de Produção (Vite)
Certifique-se de que todos os módulos e chunks empacotem sem falhas:
```bash
npm run build
```
*Critério de aprovação: A pasta `dist/` deve ser gerada com sucesso e sem falhas de importação estática/dinâmica.*

### 3. Validação das Cloud Functions (Backend)
Caso tenha feito alterações no diretório `functions/`:
```bash
cd functions
npm run build
cd ..
```
*Critério de aprovação: O TypeScript das funções deve compilar perfeitamente gerando os arquivos de distribuição.*

---

## 🔄 Fluxo de Pull Request (PR)

1. Crie uma branch específica a partir de `develop` (ou `main` se for hotfix).
2. Realize os commits atômicos seguindo o padrão estabelecido.
3. Valide os testes de compilação (`npx tsc --noEmit` e `npm run build`).
4. Abra o Pull Request para `develop` com uma descrição clara contendo:
   - O que foi alterado.
   - Evidência de compilação bem-sucedida.
   - Cenários operacionais validados manualmente.
5. Aguarde a revisão de pelo menos um desenvolvedor antes do merge.

---

Agradecemos por construir um sistema cada vez mais confiável e seguro para os pacientes e equipes da **Vallidare**!
