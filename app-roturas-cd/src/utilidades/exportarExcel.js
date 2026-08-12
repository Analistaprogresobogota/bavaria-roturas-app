import * as XLSX from 'xlsx';

// Solo se usa para EXPORTAR (nunca para leer archivos externos/subidos), asi
// que las vulnerabilidades conocidas de xlsx (parseo de archivos maliciosos)
// no aplican a este uso.
export function descargarExcel(nombreArchivo, filas) {
  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Registros');
  XLSX.writeFile(libro, `${nombreArchivo}.xlsx`);
}
