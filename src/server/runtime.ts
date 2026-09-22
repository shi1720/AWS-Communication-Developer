import type { MessagingAdapter, RuntimeStatus } from "../shared/types.js";
import { AWSMessagingAdapter } from "./adapters/messaging.js";
import { BedrockReasoningAdapter } from "./adapters/reasoning.js";
import { DynamoWorkspaceStore } from "./adapters/store.js";
import { DynamoAuthStore, LocalAuthStore } from "./auth.js";
import { RehearsalReasoningAdapter } from "./rehearsal.js";
import { LocalWorkspaceStore } from "./store.js";
import { RecoveryService } from "./service.js";
import { createFirestoreStores } from "./adapters/firestore.js";
export function createRuntime() {
  const region = process.env.AWS_REGION || "eu-west-2";
  const tableName = process.env.TABLE_NAME || process.env.DYNAMODB_TABLE;
  const firebase = process.env.FIRESTORE_PROJECT_ID
    ? createFirestoreStores(
        process.env.FIRESTORE_PROJECT_ID,
        process.env.FIRESTORE_DATABASE_ID,
      )
    : undefined;
  const store =
    firebase?.store ??
    (tableName
      ? new DynamoWorkspaceStore({ tableName, region })
      : new LocalWorkspaceStore());
  const authStore =
    firebase?.authStore ??
    (tableName ? new DynamoAuthStore(tableName, region) : new LocalAuthStore());
  const messaging: MessagingAdapter = new AWSMessagingAdapter({
    region,
    sesFromEmail: process.env.SES_FROM_EMAIL,
    sesConfigurationSet: process.env.SES_CONFIGURATION_SET,
    sesReplyToEmail: process.env.SES_REPLY_TO_EMAIL,
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    whatsappMetaApiVersion: process.env.WHATSAPP_META_API_VERSION,
    smsOriginationIdentity: process.env.SMS_ORIGINATION_IDENTITY,
    smsConfigurationSet: process.env.SMS_CONFIGURATION_SET,
    smsProtectConfigurationId: process.env.SMS_PROTECT_CONFIGURATION_ID,
  });
  const reasoning = process.env.BEDROCK_MODEL_ID
    ? new BedrockReasoningAdapter({
        region,
        modelId: process.env.BEDROCK_MODEL_ID,
      })
    : new RehearsalReasoningAdapter();
  const runtime: RuntimeStatus = {
    mode: "live",
    ai: process.env.BEDROCK_MODEL_ID ? "bedrock" : "rehearsal",
    storage: firebase
      ? "Firestore (transactional hosted preview)"
      : tableName
        ? "DynamoDB (optimistic concurrency)"
        : "Local atomic JSON (single process)",
    channels: {
      email: Boolean(process.env.SES_FROM_EMAIL),
      whatsapp: Boolean(
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_META_API_VERSION,
      ),
      sms: Boolean(process.env.SMS_ORIGINATION_IDENTITY),
    },
    region,
  };
  const service = new RecoveryService(store, messaging, reasoning);
  return { store, authStore, messaging, reasoning, runtime, service };
}
