export type PMAOriginalRow = Record<string, string>;

export type PMAComponentType =
  | "TRANSFORMADOR"
  | "INTERRUPTOR"
  | "DESCONECTADOR"
  | "BARRA"
  | "LINEA_CIRCUITO"
  | "SECCIONADOR"
  | "PROTECCIONES"
  | "TABLERO"
  | "NO_DETERMINADO";

export type PMAItem = {
  id: string;
  ot: string;
  pt: string;

  subestacionOriginal: string;
  subestacionNormalizada: string;

  textoBreve: string;
  descripcionActividad: string;
  descripcion1: string;

  actividadResumen: string;

  componenteDetectado: string;
  componenteTipo: PMAComponentType;

  especialidad: string;
  plan: string;

  fechaBase: string;
  fechaProgramada: string;
  fecha1: string;
  fechaReprogramacionFinal: string;

  estadoOriginal: string;
  estadoNormalizado: string;
  pendiente: boolean;

  reprogramado: boolean;
  ptRepetido: string;

  mesPma: string;
  mesPmaBarra: string;

  original: PMAOriginalRow;
};