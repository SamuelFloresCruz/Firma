import assert from "node:assert/strict";
import { createKeyPair, signFile, verifyFile } from "../lib/crypto";
import type { SignatureFormat } from "../types";

async function main() {
const identity = {
  name: "Estudiante de prueba",
  email: "estudiante@universidad.edu",
  organization: "Universidad Demo",
};

const keys = await createKeyPair();
assert.equal(keys.privateKey.extractable, false, "La llave privada no debe poder exportarse");

async function artifactFile(blob: Blob, name: string): Promise<File> {
  return new File([await blob.arrayBuffer()], name, { type: blob.type });
}

async function expectValid(format: SignatureFormat, original: File) {
  const signed = await signFile(original, format, identity, keys);
  const artifact = await artifactFile(signed.blob, signed.fileName);
  const result = await verifyFile(artifact, format === "P7S" ? original : null);
  assert.equal(result.status, "valid", `${format} debería ser válido: ${result.summary}`);
  return { signed, artifact };
}

const minimalPdf = new File(
  ["%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"],
  "documento.pdf",
  { type: "application/pdf" },
);
const pdf = await expectValid("PDF", minimalPdf);
assert.equal(pdf.signed.manifest.schema, "firma-clara/v2", "Las nuevas firmas deben proteger también sus metadatos");
await assert.rejects(
  () => signFile(pdf.artifact, "PDF", identity, keys),
  /ya contiene una firma PDF creada por Firma Clara/,
  "No debe permitirse volver a firmar un PDF de Firma Clara",
);

const externalSignedPdf = new File(
  ["%PDF-1.7\n1 0 obj<</Type/Sig/ByteRange [0 10 20 30]/Contents <0011>>>endobj\n%%EOF"],
  "externo-firmado.pdf",
  { type: "application/pdf" },
);
await assert.rejects(
  () => signFile(externalSignedPdf, "PDF", identity, keys),
  /firma digital PDF existente/,
  "No debe añadirse una firma académica sobre una firma PDF externa",
);

const fakePdf = new File(["esto no es un PDF"], "falso.pdf", { type: "application/pdf" });
await assert.rejects(
  () => signFile(fakePdf, "PDF", identity, keys),
  /documento PDF válido/,
  "La extensión PDF no debe bastar para aceptar contenido inválido",
);
const fakePdfVerification = await verifyFile(fakePdf);
assert.equal(fakePdfVerification.status, "invalid", "Un archivo falso con extensión PDF debe ser inválido al verificar");

const changedPdfBytes = new Uint8Array(await pdf.signed.blob.arrayBuffer());
changedPdfBytes[8] ^= 1;
const changedPdfResult = await verifyFile(new File([changedPdfBytes], pdf.signed.fileName, { type: "application/pdf" }));
assert.equal(changedPdfResult.status, "invalid", "Un PDF alterado debe ser inválido");

const appendedPdf = new File([await pdf.signed.blob.arrayBuffer(), "contenido añadido"], pdf.signed.fileName, { type: "application/pdf" });
const appendedPdfResult = await verifyFile(appendedPdf);
assert.equal(appendedPdfResult.status, "invalid", "No deben ignorarse datos añadidos después del bloque de firma");

const binaryOriginal = new File(["contenido original para firma separada"], "evidencia.txt", { type: "text/plain" });
const p7s = await expectValid("P7S", binaryOriginal);
const tamperedEnvelope = JSON.parse(await p7s.artifact.text());
tamperedEnvelope.manifest.signer.name = "Firmante sustituido";
const tamperedP7s = new File([JSON.stringify(tamperedEnvelope)], p7s.signed.fileName, { type: "application/pkcs7-signature" });
const tamperedMetadataResult = await verifyFile(tamperedP7s, binaryOriginal);
assert.equal(tamperedMetadataResult.status, "invalid", "Los metadatos del firmante deben estar protegidos por la firma");

const wrongOriginal = new File(["contenido cambiado"], "evidencia.txt", { type: "text/plain" });
const changedP7sResult = await verifyFile(p7s.artifact, wrongOriginal);
assert.equal(changedP7sResult.status, "invalid", "P7S debe detectar un original alterado");

const xmlOriginal = new File(["<Estudiante><Nombre>Ana</Nombre></Estudiante>"], "estudiante.xml", { type: "application/xml" });
const xml = await expectValid("XML", xmlOriginal);
const changedXmlText = (await xml.artifact.text()).replace("algoritmo=\"RS256\">", "algoritmo=\"RS256\">A");
const changedXmlResult = await verifyFile(new File([changedXmlText], xml.signed.fileName, { type: "application/xml" }));
assert.equal(changedXmlResult.status, "invalid", "XML debe detectar una firma alterada");

const jsonOriginal = new File([JSON.stringify({ materia: "Seguridad", nota: 100 })], "registro.json", { type: "application/json" });
const jws = await expectValid("JWS", jsonOriginal);
const jwsParts = (await jws.artifact.text()).split(".");
jwsParts[1] = `${jwsParts[1].slice(0, -1)}${jwsParts[1].endsWith("A") ? "B" : "A"}`;
const changedJwsResult = await verifyFile(new File([jwsParts.join(".")], jws.signed.fileName, { type: "application/jose" }));
assert.equal(changedJwsResult.status, "invalid", "JWS debe detectar un payload alterado");

console.log("Crypto smoke tests: PDF, P7S, XML y JWS superados.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
