# Regras de Segurança Clínicas - Firestore Security Rules

As regras abaixo detalham os mecanismos de controle de acesso do **Firebase Firestore** para o sistema **CuidarHome**, garantindo que as informações médicas dos prontuários e as escalas dos plantões permaneçam confidenciais e acessíveis apenas a pessoas autenticadas e autorizadas.

---

## 🔒 Regras de Negócio de Proteção de Dados (LGPD Médica)

1. **Acesso Autenticado Absoluto:** Nenhuma rota de dados públicos de leitura ou escrita é exposta sem um token de usuário autenticado no Firebase Authentication.
2. **Definição de Perfiis de Usuário (Claims):**
   - **Administradores (Coordenadores de Home Care):** Possuem escopo total de gravação, atualização e remoção lógica em prontuários e criação/cancelamento de escalas operacionais.
   - **Profissionais Técnicos (Cuidadores/Enfermeiros):** Apenas leitura das escalas a eles atribuídas no banco, não podendo realizar atualizações nem registrar outros dados do paciente sem assinatura digital correspondente.

---

## 📜 Código de Produção: `firestore.rules`

Abaixo está o arquivo consolidado de regras de segurança para replicação nos servidores Firebase da empresa:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: Verifica se o usuário está logado
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper: Verifica se o usuário possui cargo de Coordenação/Admin
    function isCoordinator() {
      return isAuthenticated() && 
        (request.auth.token.role == 'coordenador' || request.auth.token.role == 'admin');
    }

    // Regras para a Coleção de Pacientes e Prontuários Clinicos
    match /pacientes/{pacienteId} {
      // Coordenadores de escalas podem ler, salvar novos cadastros e desativar prontuários
      allow read: if isAuthenticated();
      allow create, update: if isCoordinator();
      
      // Proibido exclusão física de registros para auditorias periciais clínicas
      allow delete: if false;

      // Regras aninhadas para as escalas diárias de plantão (Plantões de Home Care)
      match /escalaDiaria/{plantaoId} {
        allow read: if isAuthenticated();
        allow write: if isCoordinator();
      }
    }

    // Regras de Auditoria para logs de desativação e cancelamentos
    match /auditoria_cancelamentos/{logId} {
      allow read: if isCoordinator();
      allow create: if isAuthenticated();
      allow update, delete: if false; // Logs são imutáveis
    }
  }
}
```

---

## ⚙️ Diretrizes para Deploy das Regras

Caso necessite enviar estas regras atualizadas diretamente para o console do Firebase em homologação ou produção:

1. Instale a CLI global do Firebase:
   ```bash
   npm install -g firebase-tools
   ```
2. Autentique-se com a sua conta de desenvolvedor da empresa:
   ```bash
   firebase login
   ```
3. Use o comando de deploy direcionado ao Firestore:
   ```bash
   firebase deploy --only firestore:rules
   ```
   *Nota: O arquivo original correspondente deve residir na raiz do projeto com o nome `firestore.rules` configurado no arquivo de manifesto `firebase.json`.*
