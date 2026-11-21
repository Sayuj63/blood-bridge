/**
 * Typed client for the Blood Bridge Worker API.
 * Every function returns the shared DTO type, and every non-2xx response throws
 * an ApiError carrying the server's `{ error: { code, message, details } }`.
 */
import type { z } from "zod";
import type {
  AddUnitsInput,
  AdvanceInput,
  AlertResponseInput,
  ApiError as ApiErrorBody,
  ApproveTransferInput,
  AuditEntryDTO,
  AuditVerifyDTO,
  ConfirmInput,
  CreateRequestInput,
  DeclineInput,
  DismissTransferInput,
  DonorAlertDTO,
  EraktkoshStatusDTO,
  IntegrationDTO,
  RaktSyncDTO,
  EraktkoshSyncDTO,
  DonorDTO,
  DonorSignupDTO,
  MessagingContactDTO,
  DonorDrivePreviewDTO,
  DonorDriveResultDTO,
  DonorPreferencesInput,
  ForecastDTO,
  IncomingDonorDTO,
  MetaDTO,
  OfferUnitsInput,
  QueueItemDTO,
  RequestDTO,
  ReservationDTO,
  ReserveInput,
  SearchInput,
  SearchResultDTO,
  SiteDTO,
  SiteStockDTO,
  SplitReservationDTO,
  StartSurgeInput,
  SurgeBriefDTO,
  SurgeDTO,
  TransferBoardDTO,
  TransferDTO,
  UnitActionInput,
  UnitDTO,
  donorDriveSchema,
  donorSignupSchema,
} from "../../shared/api";
import type { BloodGroup } from "../../shared/domain";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/* ─────────────────────────────── Actor ─────────────────────────────── */

/**
 * Who is acting, sent as `X-Actor` on every request and recorded in the audit
 * ledger. Format: `hospital:<siteId>`, `bank:<siteId>`, `donor:<donorId>` or `command`.
 * Each role view sets this once on mount.
 */
let actor = "command";
export const setActor = (next: string): void => {
  actor = next;
};
export const getActor = (): string => actor;

/**
 * When this tab last performed a write. The tab that acted already shows its own confirmation
 * toast, so the matching realtime echo is suppressed for a short window (see realtime.tsx).
 */
let lastWriteAt = 0;
export const msSinceLastWrite = (): number => Date.now() - lastWriteAt;

/* ─────────────────────────────── Core ─────────────────────────────── */

type Method = "GET" | "POST" | "PATCH" | "DELETE";

function isErrorBody(x: unknown): x is ApiErrorBody {
  return typeof x === "object" && x !== null && "error" in x && typeof (x as ApiErrorBody).error?.message === "string";
}

async function request<T>(method: Method, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  if (method !== "GET") lastWriteAt = Date.now();
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      signal,
      headers: {
        Accept: "application/json",
        "X-Actor": actor,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(0, "network", "Can't reach the Blood Bridge server. Check the connection and try again.");
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (isErrorBody(data)) throw new ApiError(res.status, data.error.code, data.error.message, data.error.details);
    throw new ApiError(res.status, `http_${res.status}`, `The server answered ${res.status} for ${method} ${path}.`);
  }
  return data as T;
}

const get = <T>(path: string, signal?: AbortSignal) => request<T>("GET", path, undefined, signal);
const post = <T>(path: string, body: unknown = {}) => request<T>("POST", path, body);
const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
const del = <T>(path: string) => request<T>("DELETE", path);

const enc = encodeURIComponent;
const qs = (params: Record<string, string | number | undefined>): string => {
  const entries = Object.entries(params).filter((e): e is [string, string | number] => e[1] !== undefined);
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : "";
};

/* ─────────────────────────────── Endpoints ─────────────────────────────── */

/** Inputs whose schemas apply defaults accept the pre-default shape. */
export type DonorSignupBody = z.input<typeof donorSignupSchema>;
export type DonorDriveBody = z.input<typeof donorDriveSchema>;

export interface DemoResetResult {
  sites: number;
  units: number;
  donors: number;
}

export interface AuditQuery {
  siteId?: string;
  /** Return entries with seq lower than this (pagination cursor). */
  before?: number;
  limit?: number;
}

export const api = {
  meta: (signal?: AbortSignal) => get<MetaDTO>("/api/meta", signal),

  sites: {
    list: (signal?: AbortSignal) => get<SiteDTO[]>("/api/sites", signal),
    stock: (siteId: string, signal?: AbortSignal) => get<SiteStockDTO>(`/api/sites/${enc(siteId)}/stock`, signal),
    sync: (siteId: string) => post<unknown>(`/api/sites/${enc(siteId)}/sync`),
    addUnits: (siteId: string, input: AddUnitsInput) => post<UnitDTO[]>(`/api/sites/${enc(siteId)}/units`, input),
    offer: (siteId: string, input: OfferUnitsInput) => post<unknown>(`/api/sites/${enc(siteId)}/offer`, input),
    queue: (siteId: string, signal?: AbortSignal) => get<QueueItemDTO[]>(`/api/sites/${enc(siteId)}/queue`, signal),
    incomingDonors: (siteId: string, signal?: AbortSignal) =>
      get<IncomingDonorDTO[]>(`/api/sites/${enc(siteId)}/incoming-donors`, signal),
    /** Pull this bank's live counts from e-RaktKosh. */
    syncEraktkosh: (siteId: string) => post<EraktkoshSyncDTO>(`/api/sites/${enc(siteId)}/sync-eraktkosh`),
    integrations: (siteId: string, signal?: AbortSignal) => get<IntegrationDTO[]>(`/api/sites/${enc(siteId)}/integrations`, signal),
    syncRakt: (siteId: string) => post<RaktSyncDTO>(`/api/sites/${enc(siteId)}/sync-rakt`),
  },

  eraktkosh: {
    status: (signal?: AbortSignal) => get<EraktkoshStatusDTO>("/api/eraktkosh/status", signal),
    syncAll: () => post<EraktkoshSyncDTO>("/api/eraktkosh/sync"),
  },

  units: {
    action: (unitId: string, input: UnitActionInput) => post<UnitDTO>(`/api/units/${enc(unitId)}/action`, input),
  },

  search: (input: SearchInput) => post<SearchResultDTO>("/api/search", input),

  requests: {
    create: (input: CreateRequestInput) => post<RequestDTO>("/api/requests", input),
    list: (hospitalId: string, signal?: AbortSignal) => get<RequestDTO[]>(`/api/requests${qs({ hospitalId })}`, signal),
    get: (requestId: string, signal?: AbortSignal) => get<RequestDTO>(`/api/requests/${enc(requestId)}`, signal),
    reserve: (requestId: string, input: ReserveInput) => post<RequestDTO>(`/api/requests/${enc(requestId)}/reserve`, input),
    /** Hold every uncovered unit across as few banks as possible (one call, many reservations). */
    reserveSplit: (requestId: string) => post<SplitReservationDTO>(`/api/requests/${enc(requestId)}/reserve-split`),
    critical: (requestId: string) => post<DonorDriveResultDTO>(`/api/requests/${enc(requestId)}/critical`),
  },

  reservations: {
    confirm: (reservationId: string, input: ConfirmInput = {}) =>
      post<ReservationDTO>(`/api/reservations/${enc(reservationId)}/confirm`, input),
    decline: (reservationId: string, input: DeclineInput) =>
      post<RequestDTO>(`/api/reservations/${enc(reservationId)}/decline`, input),
    advance: (reservationId: string, input: AdvanceInput) =>
      post<RequestDTO>(`/api/reservations/${enc(reservationId)}/advance`, input),
    phoneConfirm: (reservationId: string) =>
      post<ReservationDTO>(`/api/reservations/${enc(reservationId)}/phone-confirm`),
  },

  forecast: (signal?: AbortSignal) => get<ForecastDTO>("/api/forecast", signal),

  transfers: {
    board: (siteId?: string, signal?: AbortSignal) => get<TransferBoardDTO>(`/api/transfers${qs({ siteId })}`, signal),
    approve: (input: ApproveTransferInput) => post<TransferDTO>("/api/transfers", input),
    dismiss: (input: DismissTransferInput) => post<unknown>("/api/transfers/dismiss", input),
    complete: (transferId: string) => post<TransferDTO>(`/api/transfers/${enc(transferId)}/complete`),
  },

  surge: {
    start: (input: StartSurgeInput) => post<SurgeDTO>("/api/surge", input),
    end: () => del<unknown>("/api/surge"),
    /** `refresh` regenerates the brief from the current forecast instead of returning the cached one. */
    brief: (signal?: AbortSignal, refresh = false) => get<SurgeBriefDTO>(`/api/surge/brief${refresh ? "?refresh=1" : ""}`, signal),
  },

  donors: {
    personas: (signal?: AbortSignal) => get<DonorDTO[]>("/api/donors/personas", signal),
    signup: (input: DonorSignupBody) => post<DonorSignupDTO>("/api/donors", input),
    get: (donorId: string, signal?: AbortSignal) => get<DonorDTO>(`/api/donors/${enc(donorId)}`, signal),
    update: (donorId: string, input: DonorPreferencesInput) => patch<DonorDTO>(`/api/donors/${enc(donorId)}`, input),
    optOut: (donorId: string, optOut: boolean) => post<DonorDTO>(`/api/donors/${enc(donorId)}/opt-out`, { optOut }),
    alerts: (donorId: string, signal?: AbortSignal) =>
      get<DonorAlertDTO[]>(`/api/donors/${enc(donorId)}/alerts`, signal),
  },

  alerts: {
    respond: (alertId: string, input: AlertResponseInput) =>
      post<DonorAlertDTO>(`/api/alerts/${enc(alertId)}/respond`, input),
    complete: (alertId: string) => post<unknown>(`/api/alerts/${enc(alertId)}/complete`),
  },

  drives: {
    preview: (input: { bankSiteId: string; bloodGroup: BloodGroup }) =>
      post<DonorDrivePreviewDTO>("/api/drives/preview", input),
    send: (input: DonorDriveBody) => post<DonorDriveResultDTO>("/api/drives", input),
  },

  messaging: {
    /** The official Blood Bridge WhatsApp number for click-to-chat (nulls when not configured). */
    contact: (signal?: AbortSignal) => get<MessagingContactDTO>("/api/messaging/contact", signal),
  },

  audit: {
    list: (query: AuditQuery = {}, signal?: AbortSignal) => get<AuditEntryDTO[]>(`/api/audit${qs({ ...query })}`, signal),
    verify: (signal?: AbortSignal) => get<AuditVerifyDTO>("/api/audit/verify", signal),
  },

  demo: {
    /** Corrupts one ledger row so "Verify chain" can catch it. Omit seq to let the server pick. */
    tamper: (seq?: number) => post<{ seq: number }>("/api/demo/tamper", seq === undefined ? {} : { seq }),
    reset: () => post<DemoResetResult>("/api/demo/reset"),
  },
} as const;

/** Human-readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return "Something went wrong.";
}
