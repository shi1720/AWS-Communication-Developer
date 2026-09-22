import { createHash } from "node:crypto";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import {
  SocialMessagingClient,
  SendWhatsAppMessageCommand,
} from "@aws-sdk/client-socialmessaging";
import {
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";
import type {
  DeliveryResult,
  MessagePayload,
  MessagingAdapter,
} from "../../shared/types.js";

// A single SDK attempt is deliberate: these send APIs do not offer a universal
// idempotency token. An ambiguous network outcome must be reconciled, not resent.
type Sender = { send(command: any): Promise<any> };
export interface MessagingOptions {
  region: string;
  sesFromEmail?: string;
  sesConfigurationSet?: string;
  sesReplyToEmail?: string;
  whatsappPhoneNumberId?: string;
  whatsappMetaApiVersion?: string;
  smsOriginationIdentity?: string;
  smsConfigurationSet?: string;
  smsProtectConfigurationId?: string;
  clients?: { ses?: Sender; whatsapp?: Sender; sms?: Sender };
}
export class AWSMessagingAdapter implements MessagingAdapter {
  private ses: Sender;
  private whatsapp: Sender;
  private sms: Sender;
  constructor(private options: MessagingOptions) {
    const config = { region: options.region, maxAttempts: 1 };
    this.ses = options.clients?.ses ?? new SESv2Client(config);
    this.whatsapp =
      options.clients?.whatsapp ?? new SocialMessagingClient(config);
    this.sms = options.clients?.sms ?? new PinpointSMSVoiceV2Client(config);
  }
  async send(payload: MessagePayload): Promise<DeliveryResult> {
    if (!payload.text.trim() || payload.text.length > 8000)
      return {
        status: "failed",
        error: "Message must contain 1–8000 characters.",
      };
    const reference = createHash("sha256")
      .update(payload.idempotencyKey)
      .digest("hex")
      .slice(0, 32);
    try {
      let providerId: string | undefined;
      if (payload.channel === "email") {
        if (!this.options.sesFromEmail)
          return {
            status: "failed",
            error: "Amazon SES sender is not configured.",
          };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.to))
          return { status: "failed", error: "Invalid email destination." };
        const result = await this.ses.send(
          new SendEmailCommand({
            FromEmailAddress: this.options.sesFromEmail,
            Destination: { ToAddresses: [payload.to] },
            ReplyToAddresses: this.options.sesReplyToEmail
              ? [this.options.sesReplyToEmail]
              : undefined,
            ConfigurationSetName: this.options.sesConfigurationSet,
            Content: {
              Simple: {
                Subject: {
                  Data: payload.subject ?? "SecondCrate order update",
                  Charset: "UTF-8",
                },
                Body: { Text: { Data: payload.text, Charset: "UTF-8" } },
              },
            },
            EmailTags: [{ Name: "secondcrate-reference", Value: reference }],
          }),
        );
        providerId = result.MessageId;
      } else {
        if (!/^\+[1-9]\d{7,14}$/.test(payload.to))
          return {
            status: "failed",
            error: "Phone destination must use E.164 format.",
          };
        if (payload.channel === "whatsapp") {
          if (!this.options.whatsappPhoneNumberId)
            return {
              status: "failed",
              error:
                "AWS End User Messaging Social phone number is not configured.",
            };
          if (!this.options.whatsappMetaApiVersion)
            return {
              status: "failed",
              error: "WhatsApp Meta API version is not configured.",
            };
          if (payload.purpose === "offer" && !payload.template)
            return {
              status: "failed",
              error:
                "An approved marketing template is required for every WhatsApp surplus offer.",
            };
          const inboundAt = payload.lastInboundAt
            ? Date.parse(payload.lastInboundAt)
            : NaN;
          if (
            !payload.template &&
            (!Number.isFinite(inboundAt) ||
              inboundAt > Date.now() ||
              Date.now() - inboundAt >= 24 * 60 * 60 * 1000)
          ) {
            return {
              status: "failed",
              error:
                "An approved WhatsApp template is required outside the 24-hour customer service window.",
            };
          }
          const message = payload.template
            ? {
                messaging_product: "whatsapp",
                biz_opaque_callback_data: reference,
                recipient_type: "individual",
                to: payload.to.slice(1),
                type: "template",
                template: {
                  name: payload.template.name,
                  language: { code: payload.template.language },
                  components: [
                    {
                      type: "body",
                      parameters: payload.template.parameters.map((text) => ({
                        type: "text",
                        text,
                      })),
                    },
                  ],
                },
              }
            : {
                messaging_product: "whatsapp",
                biz_opaque_callback_data: reference,
                recipient_type: "individual",
                to: payload.to.slice(1),
                type: "text",
                text: { preview_url: false, body: payload.text },
              };
          const result = await this.whatsapp.send(
            new SendWhatsAppMessageCommand({
              originationPhoneNumberId: this.options.whatsappPhoneNumberId,
              metaApiVersion: this.options.whatsappMetaApiVersion,
              message: Buffer.from(JSON.stringify(message)),
            }),
          );
          providerId = result.messageId;
        } else {
          if (!this.options.smsOriginationIdentity)
            return {
              status: "failed",
              error:
                "AWS End User Messaging SMS origination identity is not configured.",
            };
          const result = await this.sms.send(
            new SendTextMessageCommand({
              DestinationPhoneNumber: payload.to,
              OriginationIdentity: this.options.smsOriginationIdentity,
              MessageBody: payload.text,
              MessageType:
                payload.purpose && payload.purpose !== "offer"
                  ? "TRANSACTIONAL"
                  : "PROMOTIONAL",
              TimeToLive: 3600,
              ConfigurationSetName: this.options.smsConfigurationSet,
              ProtectConfigurationId: this.options.smsProtectConfigurationId,
              Context: { secondcrateReference: reference },
            }),
          );
          providerId = result.MessageId;
        }
      }
      return providerId
        ? { status: "sent", providerId }
        : {
            status: "unknown",
            error:
              "Provider response did not include a message ID; review before resending.",
          };
    } catch (error) {
      const issue = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      const status = issue.$metadata?.httpStatusCode;
      const rejected = status !== undefined && status >= 400 && status < 500;
      // Never expose SDK messages, which may contain a destination address or body.
      return {
        status: rejected ? "failed" : "unknown",
        error: rejected
          ? `Provider rejected the request (${issue.name ?? "RequestRejected"}).`
          : "Provider outcome is uncertain. Reconcile delivery receipts before retrying.",
      };
    }
  }
}
