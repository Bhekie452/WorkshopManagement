/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_EMAIL_SERVER_URL: string;
  readonly VITE_AUTH_MODE?: 'firebase' | 'custom';
  readonly VITE_AUTH_SERVER_URL?: string;
  readonly VITE_SENDGRID_API_KEY: string;
  readonly VITE_SENDGRID_FROM_EMAIL: string;
  readonly VITE_PAYFAST_MERCHANT_ID: string;
  readonly VITE_PAYFAST_MERCHANT_KEY: string;
  readonly VITE_PAYFAST_PASSPHRASE: string;
  readonly VITE_PAYFAST_SANDBOX: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
