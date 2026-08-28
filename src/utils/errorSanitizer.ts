/**
 * Utilitário de Sanitização Global de Erros
 * Converte erros técnicos em mensagens amigáveis em português
 * e remove quaisquer menções a provedores ou estruturas internas (Firebase, Firestore, auth/, etc.)
 */

export function getFriendlyErrorMessage(error: unknown, fallbackMessage = 'Não foi possível completar a operação. Tente novamente.'): string {
  if (!error) {
    return fallbackMessage;
  }

  let raw = '';
  if (typeof error === 'string') {
    raw = error;
  } else if (error instanceof Error) {
    raw = `${(error as any).code || ''} ${error.message || ''}`;
  } else if (typeof error === 'object' && error !== null) {
    raw = `${(error as any).code || ''} ${(error as any).message || ''} ${JSON.stringify(error)}`;
  } else {
    raw = String(error);
  }

  const lower = raw.toLowerCase();

  // 1. Mapeamento de Autenticação
  if (
    lower.includes('auth/invalid-credential') ||
    lower.includes('invalid-credential') ||
    lower.includes('auth/wrong-password') ||
    lower.includes('wrong-password') ||
    lower.includes('auth/user-not-found') ||
    lower.includes('user-not-found') ||
    lower.includes('invalid-login-credentials')
  ) {
    return 'E-mail ou senha incorretos. Verifique os dados digitados.';
  }

  if (
    lower.includes('auth/too-many-requests') ||
    lower.includes('too-many-requests')
  ) {
    return 'Muitas tentativas incorretas. Aguarde alguns instantes.';
  }

  if (
    lower.includes('auth/invalid-email') ||
    lower.includes('invalid-email')
  ) {
    return 'Por favor, insira um e-mail válido.';
  }

  if (
    lower.includes('auth/user-disabled') ||
    lower.includes('user-disabled')
  ) {
    return 'Acesso desativado. Entre em contato com a administração.';
  }

  if (
    lower.includes('auth/email-not-verified') ||
    lower.includes('email-not-verified')
  ) {
    return 'Acesso negado: Você precisa confirmar o link que enviamos para o seu e-mail antes de acessar o sistema.';
  }

  if (
    lower.includes('auth/email-already-in-use') ||
    lower.includes('email-already-in-use')
  ) {
    return 'Este e-mail já está cadastrado no sistema.';
  }

  if (
    lower.includes('auth/weak-password') ||
    lower.includes('weak-password')
  ) {
    return 'A senha deve conter no mínimo 6 caracteres.';
  }

  // 2. Erros de Rede e Conexão
  if (
    lower.includes('auth/network-request-failed') ||
    lower.includes('network-request-failed') ||
    lower.includes('network error') ||
    lower.includes('failed to fetch') ||
    lower.includes('offline') ||
    lower.includes('unavailable')
  ) {
    return 'Falha de conexão. Verifique sua rede.';
  }

  // 3. Permissões e Cotas
  if (lower.includes('permission-denied') || lower.includes('insufficient permissions')) {
    return 'Você não possui permissão para realizar esta ação.';
  }

  if (lower.includes('resource-exhausted') || lower.includes('quota') || lower.includes('limite')) {
    return 'Limite de requisições atingido. O sistema está operando em modo de segurança.';
  }

  // 4. Verificação de mensagens limpas pré-existentes
  if (
    typeof error === 'string' &&
    !lower.includes('firebase') &&
    !lower.includes('firestore') &&
    !lower.includes('auth/') &&
    !lower.includes('error:') &&
    !lower.includes('exception') &&
    !lower.includes('banco de dados') &&
    error.trim().length > 0
  ) {
    return error;
  }

  if (
    error instanceof Error &&
    typeof error.message === 'string' &&
    !lower.includes('firebase') &&
    !lower.includes('firestore') &&
    !lower.includes('auth/') &&
    !lower.includes('error:') &&
    !lower.includes('exception') &&
    !lower.includes('banco de dados') &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  return fallbackMessage;
}
