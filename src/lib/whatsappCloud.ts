export {
  WHATSAPP_SENDER_MODE,
  WHATSAPP_SETUP_SECRETS,
  WHATSAPP_TEMPLATE_BODY_SUGGESTION,
  buildTemplateMessage,
  classifySendResponse,
  evaluateTemplateList,
  maskPhone,
  normalizeWhatsAppPhone,
  publicWhatsAppSetup,
  readWhatsAppCredentials,
  resolveLiveWhatsAppSetup,
  sanitizeTemplateParameter,
  templateLookupUrl,
} from '../../supabase/functions/_shared/whatsappCloud.ts';
export type {
  SendClassification,
  TemplateVerdict,
  WhatsAppClaim,
  WhatsAppCredentials,
  WhatsAppEnv,
  WhatsAppSecretName,
  WhatsAppSetupView,
} from '../../supabase/functions/_shared/whatsappCloud.ts';
