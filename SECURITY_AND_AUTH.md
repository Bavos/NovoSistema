# Regras de Autenticação e RBAC (Role-Based Access Control)

## 1. Níveis de Acesso
- O sistema possui duas roles fixas: `Administrador` e `Colaborador`.
- O cargo é definido APENAS pelo Administrador na aba "Empresa" e não pode ser alterado pelo próprio utilizador no menu de perfil.
- **Colaboradores:** Têm visualização bloqueada para os campos de "Dados da Empresa" e não conseguem ver ou gerir a lista de acessos.

## 2. Fluxo de Criação de Utilizadores
- O Administrador cadastra Nome, E-mail e Nível de Acesso do novo colaborador na aba "Empresa" (isso salva um documento na coleção `usuarios_sistema`).
- O Administrador NÃO cria senhas.

## 3. Fluxo de Senhas (Firebase Auth)
- Nenhuma senha é salva no Firestore (banco de dados).
- Na tela de Login, há o botão "Primeiro Acesso". O colaborador clica, insere o seu e-mail e cria a senha.
- **Validação:** O sistema só permite o `createUserWithEmailAndPassword` no Firebase Auth se o e-mail inserido já constar na coleção `usuarios_sistema` com status 'Ativo'. Caso contrário, bloqueia o acesso.
