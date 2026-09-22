export type Channel = "whatsapp" | "sms" | "email";
export type LotStatus = "draft" | "recovering" | "recovered" | "closed";
export interface Buyer {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  channel: Channel;
  consent: boolean;
  consentAt?: string;
  consentSource?: string;
  optedOut?: boolean;
  categories: string[];
  maxCrates: number;
  distanceKm: number;
  deliveryBefore: string;
  lastInboundAt?: string;
}
export interface Lot {
  id: string;
  reference: string;
  product: string;
  category: string;
  description: string;
  quantity: number;
  available: number;
  unit: string;
  unitKg: number;
  originalPrice: number;
  floorPrice: number;
  offerPrice: number;
  costPrice: number;
  dispatchBy: string;
  deliveryBy: string;
  source: string;
  sourceText: string;
  status: LotStatus;
  createdAt: string;
  safetyAttested: boolean;
}
export interface Offer {
  id: string;
  lotId: string;
  buyerId: string;
  quantity: number;
  unitPrice: number;
  status:
    | "queued"
    | "failed"
    | "unknown"
    | "sent"
    | "negotiating"
    | "accepted"
    | "declined"
    | "expired";
  createdAt: string;
}
export interface Message {
  id: string;
  buyerId: string;
  lotId?: string;
  channel: Channel;
  direction: "inbound" | "outbound";
  purpose?: "offer" | "reply" | "confirmation";
  text: string;
  createdAt: string;
  status:
    | "received"
    | "queued"
    | "simulated"
    | "sent"
    | "delivered"
    | "failed"
    | "unknown";
  providerId?: string;
  error?: string;
}
export interface Order {
  id: string;
  lotId: string;
  buyerId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  status: "confirmed" | "dispatched";
  confirmationCode: string;
}
export interface AuditEvent {
  id: string;
  lotId?: string;
  buyerId?: string;
  at: string;
  type: string;
  title: string;
  detail: string;
  actor: "agent" | "operator" | "system" | "buyer";
  metadata?: Record<string, unknown>;
}
export interface AgentStep {
  tool: string;
  status: "success" | "blocked" | "info";
  summary: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}
export interface AgentResult {
  reply: string;
  steps: AgentStep[];
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}
export interface Settings {
  companyName: string;
  operatorName: string;
  autoSend: boolean;
  maxDiscountPercent: number;
  mode: "demo" | "live";
}
export interface Workspace {
  id: string;
  version: number;
  lots: Lot[];
  buyers: Buyer[];
  offers: Offer[];
  messages: Message[];
  orders: Order[];
  events: AuditEvent[];
  settings: Settings;
  processedEvents: string[];
}
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  workspaceId: string;
  isDemo: boolean;
}
export interface RuntimeStatus {
  mode: "demo" | "live";
  ai: "rehearsal" | "bedrock";
  storage: string;
  channels: { email: boolean; whatsapp: boolean; sms: boolean };
  region: string;
}
export interface DashboardResponse {
  workspace: Workspace;
  runtime: RuntimeStatus;
  user: SessionUser;
  emailVerified?: boolean;
}
export interface InboundInput {
  buyerId: string;
  lotId: string;
  channel: Channel;
  text: string;
  eventId: string;
}
export interface AgentContext {
  workspace: Workspace;
  buyer: Buyer;
  lot: Lot;
  text: string;
}
export interface AgentDecision {
  intent:
    "accept" | "negotiate" | "decline" | "question" | "opt_out" | "unknown";
  quantity?: number;
  unitPrice?: number;
  deliveryBefore?: string;
  reply?: string;
}
export interface MessagePayload {
  purpose?: Message["purpose"];
  channel: Channel;
  to: string;
  subject?: string;
  text: string;
  idempotencyKey: string;
  lastInboundAt?: string;
  template?: { name: string; language: string; parameters: string[] };
}
export interface DeliveryResult {
  status: Message["status"];
  providerId?: string;
  error?: string;
}
export interface MessagingAdapter {
  send(payload: MessagePayload): Promise<DeliveryResult>;
}
export interface ReasoningAdapter {
  decide(context: AgentContext): Promise<{
    decision: AgentDecision;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
  }>;
}
export interface WorkspaceStore {
  get(id: string): Promise<Workspace | undefined>;
  create(workspace: Workspace): Promise<void>;
  save(workspace: Workspace, expectedVersion: number): Promise<void>;
}
