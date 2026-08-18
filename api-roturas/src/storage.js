import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from '@azure/storage-blob';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';

// Almacenamiento de evidencias (foto del suceso, foto del conciliador, firma)
// en un contenedor privado de Azure Blob Storage — ver informe tecnico de
// Tecnologia: PostgreSQL solo guarda la RUTA RELATIVA, nunca la imagen en
// base64. El contenedor no debe ser publico; el acceso de lectura se hace
// siempre por una URL firmada (SAS) de vencimiento corto generada aqui.

const CONTAINER = process.env.AZURE_STORAGE_CONTAINER || 'evidencias-roturas';
const URL_EXPIRA_MINUTOS = Number(process.env.EVIDENCIA_URL_EXPIRA_MINUTOS || 10);

const TIPOS_PERMITIDOS = {
  suceso: { mimes: ['image/jpeg', 'image/png'], ext: { 'image/jpeg': 'jpg', 'image/png': 'png' } },
  conciliador: { mimes: ['image/jpeg', 'image/png'], ext: { 'image/jpeg': 'jpg', 'image/png': 'png' } },
  firma: { mimes: ['image/png'], ext: { 'image/png': 'png' } },
};
const TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024; // 8 MB por archivo

let clienteBlob = null;
function obtenerCliente() {
  if (clienteBlob) return clienteBlob;
  const cadenaConexion = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!cadenaConexion) {
    throw new Error(
      'Falta AZURE_STORAGE_CONNECTION_STRING en el entorno. Este valor lo entrega Tecnologia junto con los demas secretos.'
    );
  }
  clienteBlob = BlobServiceClient.fromConnectionString(cadenaConexion);
  return clienteBlob;
}

// Valida tipo/tamaño de un archivo recibido antes de subirlo. Nunca confia
// en el nombre original enviado por el dispositivo, solo en el mimetype real
// detectado por multer/Express a partir del contenido del upload.
export function validarEvidencia(tipo, archivo) {
  const regla = TIPOS_PERMITIDOS[tipo];
  if (!regla) return `Tipo de evidencia no reconocido: ${tipo}.`;
  if (!archivo) return 'No se recibio ningun archivo.';
  if (!regla.mimes.includes(archivo.mimetype)) {
    return `Formato no permitido para ${tipo}: ${archivo.mimetype}. Se aceptan: ${regla.mimes.join(', ')}.`;
  }
  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    return `El archivo supera el tamaño máximo permitido (${TAMANO_MAXIMO_BYTES / 1024 / 1024} MB).`;
  }
  return null;
}

// Sube el archivo y devuelve la RUTA RELATIVA a guardar en Postgres, ej.
// "progreso/2026/08/{uuid}-suceso.jpg". Esa misma ruta es el nombre del blob
// dentro del contenedor privado.
export async function subirEvidencia(tipo, archivo) {
  const regla = TIPOS_PERMITIDOS[tipo];
  const extension = regla.ext[archivo.mimetype];
  const ahora = new Date();
  const anio = ahora.getUTCFullYear();
  const mes = String(ahora.getUTCMonth() + 1).padStart(2, '0');
  const ruta = `progreso/${anio}/${mes}/${randomUUID()}-${tipo}.${extension}`;

  const cliente = obtenerCliente();
  const contenedor = cliente.getContainerClient(CONTAINER);
  const blockBlob = contenedor.getBlockBlobClient(ruta);
  await blockBlob.uploadData(archivo.buffer, {
    blobHTTPHeaders: { blobContentType: archivo.mimetype },
  });

  return ruta;
}

// Genera una URL temporal firmada (SAS) de lectura para mostrar una
// evidencia puntual en el detalle del registro. Vencimiento corto — el
// contenedor sigue siendo privado en todo momento.
export function urlTemporal(rutaRelativa) {
  const cadenaConexion = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const cuenta = /AccountName=([^;]+)/.exec(cadenaConexion)?.[1];
  const clave = /AccountKey=([^;]+)/.exec(cadenaConexion)?.[1];
  if (!cuenta || !clave) {
    throw new Error('No se pudo derivar cuenta/clave de AZURE_STORAGE_CONNECTION_STRING para firmar la URL.');
  }
  const credencial = new StorageSharedKeyCredential(cuenta, clave);
  const vencimiento = new Date(Date.now() + URL_EXPIRA_MINUTOS * 60 * 1000);
  const sas = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER,
      blobName: rutaRelativa,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn: vencimiento,
    },
    credencial
  ).toString();
  return `https://${cuenta}.blob.core.windows.net/${CONTAINER}/${rutaRelativa}?${sas}`;
}

// Borra un blob huerfano (ej. si se subio la evidencia pero el registro
// nunca se llego a crear, o si se elimina un registro y nadie mas referencia
// esa misma ruta).
export async function eliminarEvidencia(rutaRelativa) {
  if (!rutaRelativa) return;
  const cliente = obtenerCliente();
  const contenedor = cliente.getContainerClient(CONTAINER);
  await contenedor.getBlockBlobClient(rutaRelativa).deleteIfExists();
}
