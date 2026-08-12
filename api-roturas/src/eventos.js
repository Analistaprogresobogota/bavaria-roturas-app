import { EventEmitter } from 'node:events';

// Reemplaza el "postgres_changes" de Supabase Realtime con algo mucho mas
// simple: un emisor de eventos en memoria + Server-Sent Events (SSE). Cuando
// alguien crea o borra un registro, se avisa a todos los navegadores/apps
// conectados para que refresquen la tabla, sin tener que recargar la pagina.
//
// Limitacion a proposito, para mantenerlo simple: solo funciona si la API
// corre en UN solo proceso/instancia (no sirve tal cual si el dia de mañana
// se escala a varias instancias detras de un balanceador — en ese caso
// tocaria pasar esto a Postgres LISTEN/NOTIFY o a un bus de mensajes).
export const cambios = new EventEmitter();
cambios.setMaxListeners(0);
