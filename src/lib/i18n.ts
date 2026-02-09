export const translations = {
  pt: {
    // Landing/Language selection
    selectLanguage: 'Selecione o idioma',
    continue: 'Continuar',
    
    // Auth
    login: 'Entrar',
    signup: 'Criar conta',
    email: 'E-mail',
    password: 'Senha',
    firstName: 'Nome',
    lastName: 'Sobrenome',
    confirmPassword: 'Confirmar senha',
    forgotPassword: 'Esqueceu a senha?',
    dontHaveAccount: 'Não tem conta?',
    alreadyHaveAccount: 'Já tem conta?',
    signInHere: 'Entre aqui',
    signUpHere: 'Cadastre-se aqui',
    
    // Dashboard
    welcomeBack: 'Bem-vindo',
    dashboard: 'Painel',
    activityRecord: 'Registro de Atividade',
    maintenance: 'Manutenção',
    damages: 'Danos',
    fuel: 'Combustível',
    orders: 'Pedidos',
    support: 'Suporte TI',
    
    // Activity registration
    startActivity: 'Iniciar Atividade',
    endActivity: 'Finalizar Atividade',
    selectMachine: 'Selecionar Máquina',
    odometer: 'Hodômetro',
    takeSelfie: 'Tirar Selfie',
    location: 'Localização',
    notes: 'Observações',
    register: 'Registrar',
    finish: 'Finalizar',
    
    // Status
    pendingValidation: 'Aguardando validação',
    validated: 'Validado',
    rejected: 'Rejeitado',
    
    // Common
    logout: 'Sair',
    loading: 'Carregando...',
    error: 'Erro',
    success: 'Sucesso',
    cancel: 'Cancelar',
  },
  en: {
    // Landing/Language selection
    selectLanguage: 'Select Language',
    continue: 'Continue',
    
    // Auth
    login: 'Login',
    signup: 'Sign Up',
    email: 'Email',
    password: 'Password',
    firstName: 'First Name',
    lastName: 'Last Name',
    confirmPassword: 'Confirm Password',
    forgotPassword: 'Forgot password?',
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: 'Already have an account?',
    signInHere: 'Sign in here',
    signUpHere: 'Sign up here',
    
    // Dashboard
    welcomeBack: 'Welcome back',
    dashboard: 'Dashboard',
    activityRecord: 'Activity Record',
    maintenance: 'Maintenance',
    damages: 'Damages',
    fuel: 'Fuel',
    orders: 'Orders',
    support: 'IT Support',
    
    // Activity registration
    startActivity: 'Start Activity',
    endActivity: 'End Activity',
    selectMachine: 'Select Machine',
    odometer: 'Odometer',
    takeSelfie: 'Take Selfie',
    location: 'Location',
    notes: 'Notes',
    register: 'Register',
    finish: 'Finish',
    
    // Status
    pendingValidation: 'Pending validation',
    validated: 'Validated',
    rejected: 'Rejected',
    
    // Common
    logout: 'Logout',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
  },
} as const;

export type Language = 'pt' | 'en';
export type TranslationKey = keyof typeof translations.pt;
