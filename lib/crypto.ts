import type {
  SignatureEnvelope,
  SignatureFormat,
  SignatureManifest,
  SignerIdentity,
  ValidationCheck,
  ValidationResult,
} from "@/types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PDF_START = encoder.encode("\n%FIRMA_CLARA_START:");
const PDF_END = encoder.encode("\n%FIRMA_CLARA_END\n");
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export interface GeneratedKeyPair {
  privateKey: CryptoKey;
  publicJwk: JsonWebKey;
  fingerprint: string;
  createdAt: string;
}

function bytesToBinary(bytes: Uint8Array): string {
  let output = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    output += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return output;
}

export function toBase64Url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return btoa(bytesToBinary(bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function joinBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function findLastSequence(source: Uint8Array, target: Uint8Array): number {
  for (let index = source.length - target.length; index >= 0; index -= 1) {
    let matches = true;
    for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
      if (source[index + targetIndex] !== target[targetIndex]) {
        matches = false;
        break;
      }
    }
    if (matches) return index;
  }
  return -1;
}

function findSequence(source: Uint8Array, target: Uint8Array, start = 0): number {
  for (let index = start; index <= source.length - target.length; index += 1) {
    let matches = true;
    for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
      if (source[index + targetIndex] !== target[targetIndex]) {
        matches = false;
        break;
      }
    }
    if (matches) return index;
  }
  return -1;
}

function groupFingerprint(value: string): string {
  return value.match(/.{1,4}/g)?.join(" ") ?? value;
}

function normalizeFingerprint(value: string): string {
  return value.replace(/\s/g, "").toLowerCase();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return toBase64Url(new Uint8Array(digest));
}

export async function createKeyPair(): Promise<GeneratedKeyPair> {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const publicBytes = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", publicBytes as BufferSource));

  return {
    privateKey: pair.privateKey,
    publicJwk,
    fingerprint: groupFingerprint(bytesToHex(digest)),
    createdAt: new Date().toISOString(),
  };
}

async function signBytes(privateKey: CryptoKey, bytes: Uint8Array): Promise<string> {
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, bytes as BufferSource);
  return toBase64Url(new Uint8Array(signature));
}

function assertPublicJwk(value: unknown): asserts value is JsonWebKey {
  if (!isRecord(value) || value.kty !== "RSA" || typeof value.n !== "string" || typeof value.e !== "string" || typeof value.d === "string") {
    throw new Error("La llave pública incluida no es una JWK RSA válida.");
  }
  if (fromBase64Url(value.n).length < 256) {
    throw new Error("La llave RSA incluida es menor a 2048 bits.");
  }
}

async function importPublicKey(publicJwk: JsonWebKey): Promise<CryptoKey> {
  assertPublicJwk(publicJwk);
  return crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["verify"],
  );
}

async function verifyBytes(publicJwk: JsonWebKey, bytes: Uint8Array, signature: string): Promise<boolean> {
  const publicKey = await importPublicKey(publicJwk);
  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    fromBase64Url(signature) as BufferSource,
    bytes as BufferSource,
  );
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertManifest(value: unknown, expectedFormat?: SignatureFormat): asserts value is SignatureManifest {
  if (!isRecord(value) || (value.schema !== "firma-clara/v1" && value.schema !== "firma-clara/v2")) {
    throw new Error("El manifiesto de firma no pertenece a Firma Clara.");
  }
  if (!(["PDF", "P7S", "XML", "JWS"] as const).includes(value.format as SignatureFormat) || (expectedFormat && value.format !== expectedFormat)) {
    throw new Error("El formato declarado no coincide con el archivo firmado.");
  }
  if (value.algorithm !== "RS256" || value.digestAlgorithm !== "SHA-256" || typeof value.digest !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.digest)) {
    throw new Error("El manifiesto declara algoritmos no compatibles.");
  }
  if (typeof value.originalName !== "string" || typeof value.originalType !== "string" || typeof value.originalSize !== "number" || value.originalSize < 0) {
    throw new Error("Los datos del archivo original son inválidos.");
  }
  if (typeof value.signedAt !== "string" || Number.isNaN(Date.parse(value.signedAt))) {
    throw new Error("La fecha de firma es inválida.");
  }
  const signer = value.signer;
  if (!isRecord(signer) || typeof signer.name !== "string" || !signer.name.trim() || typeof signer.email !== "string" || !signer.email.trim()) {
    throw new Error("Los datos del firmante están incompletos.");
  }
  if (signer.organization !== undefined && typeof signer.organization !== "string") {
    throw new Error("La organización del firmante no es válida.");
  }
  if (typeof signer.fingerprint !== "string") {
    throw new Error("La llave pública del firmante no es válida.");
  }
  assertPublicJwk(signer.publicJwk);
}

async function publicKeyFingerprints(publicJwk: JsonWebKey): Promise<{ current: string; legacy: string }> {
  const publicKey = await importPublicKey(publicJwk);
  const publicBytes = new Uint8Array(await crypto.subtle.exportKey("spki", publicKey));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", publicBytes as BufferSource));
  const legacyDigest = await sha256(publicBytes);
  return {
    current: groupFingerprint(bytesToHex(digest)),
    legacy: groupFingerprint(legacyDigest.slice(0, 32).toUpperCase()),
  };
}

async function fingerprintMatches(manifest: SignatureManifest, comparisonKey?: JsonWebKey): Promise<boolean> {
  const manifestFingerprints = await publicKeyFingerprints(manifest.signer.publicJwk);
  const stored = normalizeFingerprint(manifest.signer.fingerprint);
  const expected = manifest.schema === "firma-clara/v2" ? manifestFingerprints.current : manifestFingerprints.legacy;
  if (stored !== normalizeFingerprint(expected)) return false;
  if (!comparisonKey) return true;
  const comparisonFingerprints = await publicKeyFingerprints(comparisonKey);
  return normalizeFingerprint(manifestFingerprints.current) === normalizeFingerprint(comparisonFingerprints.current);
}

function hasStandardPdfSignature(bytes: Uint8Array): boolean {
  const text = decoder.decode(bytes);
  return /\/ByteRange\s*\[/.test(text) && /\/Contents\s*</.test(text);
}

function hasPdfHeader(bytes: Uint8Array): boolean {
  return decoder.decode(bytes.slice(0, 1024)).includes("%PDF-");
}

function detectExistingSignature(bytes: Uint8Array, fileName: string): string | null {
  const extension = extensionOf(fileName);
  if (findLastSequence(bytes, PDF_START) >= 0) return "una firma PDF creada por Firma Clara";
  if (extension === "pdf" && hasStandardPdfSignature(bytes)) return "una firma digital PDF existente";

  const text = decoder.decode(bytes).trim();
  if (extension === "xml" && (/<fc:DocumentoFirmado\b/.test(text) || /<(?:\w+:)?Signature\b/.test(text))) return "una firma XML existente";

  if (extension === "p7s") return "un contenedor de firma P7S";
  try {
    const parsed = JSON.parse(text) as unknown;
    if (isRecord(parsed) && isRecord(parsed.manifest) && (parsed.manifest.schema === "firma-clara/v1" || parsed.manifest.schema === "firma-clara/v2") && typeof parsed.signature === "string") {
      return "un contenedor de firma de Firma Clara";
    }
  } catch {
    // El archivo no es un contenedor JSON; puede ser un documento original normal.
  }

  const parts = text.split(".");
  if (extension === "jws") return "una firma JWS existente";
  if (parts.length === 3 && parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) {
    try {
      const header = JSON.parse(decoder.decode(fromBase64Url(parts[0]))) as unknown;
      if (isRecord(header) && typeof header.alg === "string") return "una firma JWS existente";
    } catch {
      // Tres fragmentos de texto no constituyen un JWS sin un encabezado JSON válido.
    }
  }
  return null;
}

function validateSigningSource(file: File, format: SignatureFormat, source: Uint8Array): void {
  if (source.length === 0) throw new Error("El archivo está vacío.");
  if (source.length > MAX_FILE_SIZE) throw new Error("El archivo supera el límite de 20 MB.");

  const existingSignature = detectExistingSignature(source, file.name);
  if (existingSignature) {
    throw new Error(`El archivo ya contiene ${existingSignature}. No se admiten firmas múltiples.`);
  }

  const extension = extensionOf(file.name);
  if (format === "PDF" && (extension !== "pdf" || !hasPdfHeader(source))) {
    throw new Error("Selecciona un documento PDF válido para firmar como PDF.");
  }
  if (format === "XML" && (extension !== "xml" || !decoder.decode(source).trimStart().startsWith("<"))) {
    throw new Error("Selecciona un documento XML válido para firmar como XML.");
  }
  if (format === "JWS" && extension !== "json" && extension !== "txt") {
    throw new Error("Para crear un JWS selecciona un archivo JSON o TXT.");
  }
}

function validateSignerIdentity(identity: SignerIdentity): void {
  const name = identity.name.trim();
  const email = identity.email.trim();
  const organization = identity.organization?.trim() ?? "";
  if (!name || name.length > 120) throw new Error("El nombre del firmante no es válido.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("El correo del firmante no es válido.");
  if (organization.length > 160) throw new Error("El nombre de la organización es demasiado largo.");
}

export async function validateFileForSigning(file: File, format: SignatureFormat): Promise<void> {
  validateSigningSource(file, format, new Uint8Array(await file.arrayBuffer()));
}

function envelopeSigningPayload(manifest: SignatureManifest, content: Uint8Array): Uint8Array {
  return manifest.schema === "firma-clara/v2" ? encoder.encode(JSON.stringify(manifest)) : content;
}

function buildManifest(
  file: File,
  format: SignatureFormat,
  digest: string,
  identity: SignerIdentity,
  keys: GeneratedKeyPair,
): SignatureManifest {
  return {
    schema: "firma-clara/v2",
    format,
    algorithm: "RS256",
    digestAlgorithm: "SHA-256",
    digest,
    originalName: file.name,
    originalType: file.type || "application/octet-stream",
    originalSize: file.size,
    signedAt: new Date().toISOString(),
    signer: {
      ...identity,
      publicJwk: keys.publicJwk,
      fingerprint: keys.fingerprint,
    },
  };
}

export async function signFile(
  file: File,
  format: SignatureFormat,
  identity: SignerIdentity,
  keys: GeneratedKeyPair,
): Promise<{ blob: Blob; fileName: string; manifest: SignatureManifest }> {
  const source = new Uint8Array(await file.arrayBuffer());
  validateSigningSource(file, format, source);
  validateSignerIdentity(identity);
  const digest = await sha256(source);
  const manifest = buildManifest(file, format, digest, identity, keys);

  if (format === "JWS") {
    const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWS", jwk: keys.publicJwk, fc: manifest }));
    const payload = toBase64Url(source);
    const signingInput = encoder.encode(`${header}.${payload}`);
    const signature = await signBytes(keys.privateKey, signingInput);
    return {
      blob: new Blob([`${header}.${payload}.${signature}`], { type: "application/jose" }),
      fileName: `${baseName(file.name)}.jws`,
      manifest,
    };
  }

  const signature = await signBytes(keys.privateKey, envelopeSigningPayload(manifest, source));
  const envelope: SignatureEnvelope = { manifest, signature };

  if (format === "P7S") {
    envelope.detached = true;
    return {
      blob: new Blob([JSON.stringify(envelope, null, 2)], { type: "application/pkcs7-signature" }),
      fileName: `${file.name}.p7s`,
      manifest,
    };
  }

  if (format === "XML") {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<fc:DocumentoFirmado xmlns:fc="urn:firma-clara:signature:v2">',
      `  <fc:Manifest encoding="base64url">${toBase64Url(JSON.stringify(manifest))}</fc:Manifest>`,
      `  <fc:Contenido encoding="base64url">${toBase64Url(source)}</fc:Contenido>`,
      `  <fc:ValorFirma algoritmo="RS256">${signature}</fc:ValorFirma>`,
      "</fc:DocumentoFirmado>",
    ].join("\n");
    return {
      blob: new Blob([xml], { type: "application/xml" }),
      fileName: `${baseName(file.name)}-firmado.xml`,
      manifest,
    };
  }

  const encodedEnvelope = encoder.encode(toBase64Url(JSON.stringify(envelope)));
  const signedPdf = joinBytes(source, PDF_START, encodedEnvelope, PDF_END);
  return {
    blob: new Blob([toArrayBuffer(signedPdf)], { type: "application/pdf" }),
    fileName: `${baseName(file.name)}-firmado.pdf`,
    manifest,
  };
}

function coreChecks(manifest: SignatureManifest, signatureValid: boolean, digestValid: boolean, keyValid: boolean): ValidationCheck[] {
  return [
    {
      label: "Firma criptográfica",
      status: signatureValid ? "passed" : "failed",
      detail: signatureValid ? "La firma RSA corresponde al contenido analizado." : "La firma no corresponde al contenido.",
    },
    {
      label: "Integridad del contenido",
      status: digestValid ? "passed" : "failed",
      detail: digestValid ? "La huella SHA-256 coincide; no se detectaron cambios." : "La huella cambió después de la firma.",
    },
    {
      label: "Llave pública",
      status: keyValid ? "passed" : "failed",
      detail: keyValid ? "La huella corresponde a la llave pública incluida." : "La huella o la llave pública fue alterada.",
    },
    {
      label: "Identidad del firmante",
      status: "warning",
      detail: `Comprueba que los datos de ${manifest.signer.name} correspondan al firmante esperado.`,
    },
  ];
}

async function verifyEnvelope(envelope: SignatureEnvelope, content: Uint8Array, expectedFormat: SignatureFormat): Promise<ValidationResult> {
  assertManifest(envelope.manifest, expectedFormat);
  if (typeof envelope.signature !== "string" || !/^[A-Za-z0-9_-]+$/.test(envelope.signature)) throw new Error("El valor de la firma es inválido.");
  const digest = await sha256(content);
  const digestValid = digest === envelope.manifest.digest && content.length === envelope.manifest.originalSize;
  const signatureValid = await verifyBytes(
    envelope.manifest.signer.publicJwk,
    envelopeSigningPayload(envelope.manifest, content),
    envelope.signature,
  );
  const keyValid = await fingerprintMatches(envelope.manifest);
  const cryptographicallyValid = digestValid && signatureValid && keyValid;
  const legacy = envelope.manifest.schema === "firma-clara/v1";
  const checks = coreChecks(envelope.manifest, signatureValid, digestValid, keyValid);
  if (legacy && cryptographicallyValid) {
    checks.push({
      label: "Metadatos de la firma",
      status: "warning",
      detail: "Esta evidencia antigua no protege criptográficamente todos los datos del firmante.",
    });
  }
  return {
    status: cryptographicallyValid ? (legacy ? "indeterminate" : "valid") : "invalid",
    format: envelope.manifest.format,
    title: cryptographicallyValid ? (legacy ? "Firma antigua con verificación parcial" : "La integridad es válida") : "La firma no es válida",
    summary: cryptographicallyValid
      ? legacy
        ? "El contenido coincide, pero los metadatos pertenecen a una versión anterior y no pueden considerarse verificados."
        : "El contenido coincide con la firma y no fue modificado."
      : "La firma o la huella digital no coincide con el contenido proporcionado.",
    manifest: envelope.manifest,
    digest,
    checks,
    technicalDetail: `Verificación ${envelope.manifest.schema.replace("firma-clara/", "Firma Clara ")} · RSASSA-PKCS1-v1_5 · SHA-256`,
  };
}

function unknownResult(format: SignatureFormat, title: string, summary: string, detail: string): ValidationResult {
  return {
    status: "indeterminate",
    format,
    title,
    summary,
    checks: [
      { label: "Formato detectado", status: "passed", detail },
      {
        label: "Motor compatible",
        status: "warning",
        detail: "El archivo utiliza una estructura externa y requiere un validador compatible con ese estándar.",
      },
    ],
  };
}

export function inferFormat(fileName: string): SignatureFormat | null {
  const extension = extensionOf(fileName);
  if (extension === "pdf") return "PDF";
  if (extension === "p7s") return "P7S";
  if (extension === "xml") return "XML";
  if (extension === "jws") return "JWS";
  return null;
}

export async function verifyFile(file: File, originalFile?: File | null): Promise<ValidationResult> {
  const format = inferFormat(file.name);
  if (!format) throw new Error("Formato no compatible. Usa PDF, P7S, XML o JWS.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) throw new Error("El archivo está vacío.");
  if (bytes.length > MAX_FILE_SIZE) throw new Error("El archivo supera el límite de 20 MB.");
  if (originalFile && originalFile.size > MAX_FILE_SIZE) throw new Error("El documento original supera el límite de 20 MB.");

  try {
    if (format === "PDF") {
      if (!hasPdfHeader(bytes)) throw new Error("El archivo no contiene una estructura PDF válida.");
      const markerIndex = findLastSequence(bytes, PDF_START);
      if (markerIndex < 0) {
        if (hasStandardPdfSignature(bytes)) {
          return unknownResult("PDF", "Firma PDF externa detectada", "El PDF contiene una firma estándar que requiere un validador PAdES compatible.", "Estructuras ByteRange y Contents presentes.");
        }
        return {
          status: "unsigned",
          format: "PDF",
          title: "PDF sin firma reconocida",
          summary: "No se encontró una firma creada por Firma Clara.",
          digest: await sha256(bytes),
          checks: [{ label: "Firma incrustada", status: "warning", detail: "No se encontró un bloque de firma de Firma Clara." }],
        };
      }
      if (findLastSequence(bytes.slice(0, markerIndex), PDF_START) >= 0) {
        throw new Error("El PDF contiene varias firmas de Firma Clara superpuestas y no puede validarse de forma segura.");
      }
      const endIndex = findSequence(bytes, PDF_END, markerIndex + PDF_START.length);
      if (endIndex < markerIndex) throw new Error("El bloque de firma PDF está incompleto.");
      if (endIndex + PDF_END.length !== bytes.length) throw new Error("Se detectaron datos añadidos después de la firma PDF.");
      const originalContent = bytes.slice(0, markerIndex);
      if (hasStandardPdfSignature(originalContent)) {
        throw new Error("El PDF combina una firma externa con una firma de Firma Clara no compatible.");
      }
      const encoded = decoder.decode(bytes.slice(markerIndex + PDF_START.length, endIndex));
      const envelope = JSON.parse(decoder.decode(fromBase64Url(encoded))) as SignatureEnvelope;
      return verifyEnvelope(envelope, originalContent, "PDF");
    }

    if (format === "P7S") {
      let envelope: SignatureEnvelope;
      try {
        envelope = JSON.parse(decoder.decode(bytes)) as SignatureEnvelope;
      } catch {
        return unknownResult("P7S", "Contenedor CMS/P7S externo detectado", "El archivo parece ser un P7S estándar y necesita validación CMS/CAdES especializada.", "Archivo binario o contenedor no perteneciente a Firma Clara.");
      }
      if (envelope.manifest?.schema !== "firma-clara/v1" && envelope.manifest?.schema !== "firma-clara/v2") {
        return unknownResult("P7S", "P7S externo detectado", "El contenedor no pertenece al formato de Firma Clara.", "Contenedor P7S no reconocido.");
      }
      assertManifest(envelope.manifest, "P7S");
      if (!originalFile) {
        return {
          status: "indeterminate",
          format: "P7S",
          title: "Falta el archivo original",
          summary: "Esta firma es separada. Selecciona el documento original para comprobarla.",
          manifest: envelope.manifest,
          checks: [{ label: "Documento original", status: "warning", detail: `Se espera: ${envelope.manifest.originalName}` }],
        };
      }
      return verifyEnvelope(envelope, new Uint8Array(await originalFile.arrayBuffer()), "P7S");
    }

    if (format === "XML") {
      const xml = decoder.decode(bytes);
      if (!xml.trimStart().startsWith("<")) throw new Error("El archivo no contiene una estructura XML válida.");
      const manifestMatch = xml.match(/<fc:Manifest[^>]*>([^<]+)<\/fc:Manifest>/);
      const contentMatch = xml.match(/<fc:Contenido[^>]*>([^<]+)<\/fc:Contenido>/);
      const signatureMatch = xml.match(/<fc:ValorFirma[^>]*>([^<]+)<\/fc:ValorFirma>/);
      if (!manifestMatch || !contentMatch || !signatureMatch) {
        if (xml.includes("Signature")) {
          return unknownResult("XML", "Firma XML externa detectada", "Se encontró una estructura de firma XML que requiere validación XMLDSig/XAdES especializada.", "Elemento Signature detectado.");
        }
        return unknownResult("XML", "XML sin firma reconocida", "No se encontró una firma de Firma Clara dentro del documento.", "Documento XML legible, sin envoltorio Firma Clara.");
      }
      const manifest = JSON.parse(decoder.decode(fromBase64Url(manifestMatch[1]))) as SignatureManifest;
      return verifyEnvelope({ manifest, signature: signatureMatch[1] }, fromBase64Url(contentMatch[1]), "XML");
    }

    const compact = decoder.decode(bytes).trim();
    const parts = compact.split(".");
    if (parts.length !== 3) throw new Error("El archivo JWS no tiene tres segmentos.");
    const header = JSON.parse(decoder.decode(fromBase64Url(parts[0]))) as { alg?: string; jwk?: JsonWebKey; fc?: SignatureManifest };
    if (header.alg !== "RS256" || !header.jwk) {
      return unknownResult("JWS", "JWS sin clave verificable", "El encabezado no incluye una clave JWK compatible con RS256.", `Algoritmo declarado: ${header.alg ?? "desconocido"}.`);
    }
    const signatureValid = await verifyBytes(header.jwk, encoder.encode(`${parts[0]}.${parts[1]}`), parts[2]);
    const payload = fromBase64Url(parts[1]);
    const digest = await sha256(payload);
    const manifest = header.fc;
    if (manifest) assertManifest(manifest, "JWS");
    const digestValid = Boolean(manifest && manifest.digest === digest && manifest.originalSize === payload.length);
    const keyValid = manifest ? await fingerprintMatches(manifest, header.jwk) : true;
    const valid = signatureValid && keyValid && (!manifest || digestValid);
    return {
      status: valid ? "valid" : "invalid",
      format: "JWS",
      title: valid ? "JWS válido" : "JWS inválido",
      summary: valid ? "La firma RS256 coincide con el encabezado y el contenido." : "La firma JWS o su huella no coincide.",
      manifest,
      digest,
      checks: manifest
        ? coreChecks(manifest, signatureValid, digestValid, keyValid)
        : [
            { label: "Firma criptográfica", status: signatureValid ? "passed" : "failed", detail: signatureValid ? "Firma RS256 válida." : "Firma RS256 inválida." },
            { label: "Metadatos de firma", status: "warning", detail: "JWS estándar sin metadatos adicionales de Firma Clara." },
          ],
      technicalDetail: "JSON Web Signature · Compact Serialization · RS256",
    };
  } catch (error) {
    return {
      status: "invalid",
      format,
      title: "No se pudo validar el archivo",
      summary: error instanceof Error ? error.message : "El archivo está dañado o no cumple el formato esperado.",
      checks: [{ label: "Lectura del formato", status: "failed", detail: "La estructura de firma no pudo interpretarse." }],
    };
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
