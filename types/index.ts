export type SignatureFormat = "PDF" | "P7S" | "XML" | "JWS";

export type ActivityStatus = "valid" | "invalid" | "indeterminate" | "signed";

export interface SignerIdentity {
  name: string;
  email: string;
  organization?: string;
}

export interface PublicSigner extends SignerIdentity {
  fingerprint: string;
  publicJwk: JsonWebKey;
}

export interface SignatureManifest {
  schema: "firma-clara/v1" | "firma-clara/v2";
  format: SignatureFormat;
  algorithm: "RS256";
  digestAlgorithm: "SHA-256";
  digest: string;
  originalName: string;
  originalType: string;
  originalSize: number;
  signedAt: string;
  signer: PublicSigner;
}

export interface SignatureEnvelope {
  manifest: SignatureManifest;
  signature: string;
  detached?: boolean;
  content?: string;
}

export interface ValidationCheck {
  label: string;
  status: "passed" | "failed" | "warning";
  detail: string;
}

export interface ValidationResult {
  status: "valid" | "invalid" | "indeterminate" | "unsigned";
  format: SignatureFormat;
  title: string;
  summary: string;
  manifest?: SignatureManifest;
  checks: ValidationCheck[];
  digest?: string;
  technicalDetail?: string;
}

export interface ActivityRecord {
  id: string;
  action: "sign" | "verify";
  format: SignatureFormat;
  fileName: string;
  fileSize: number;
  status: ActivityStatus;
  digest?: string;
  createdAt: string;
}
