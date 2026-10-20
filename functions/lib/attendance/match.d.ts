/** Distancia euclidiana maxima para aceptar que dos caras son la misma persona.
 *  0.6 es el umbral clasico de face-api; 0.5 es mas estricto para no confundir
 *  gente parecida. */
export declare const MATCH_MAX_DISTANCE = 0.5;
/** El segundo candidato tiene que quedar al menos esta distancia mas lejos. Si
 *  dos empleados quedan casi empatados, no se marca a ninguno. */
export declare const MATCH_MIN_MARGIN = 0.06;
/** Segundo nivel: entre MATCH_MAX_DISTANCE y esto se acepta solo si dos fotos
 *  de la rafaga coinciden y hay mucha ventaja sobre el segundo. Rescata a quien
 *  tiene una sola referencia floja (foto de otra camara) o mala luz ese dia. */
export declare const MATCH_SOFT_MAX_DISTANCE = 0.55;
export declare const MATCH_SOFT_MIN_MARGIN = 0.12;
/** Por debajo de esta distancia (y con ventaja clara) la marcacion es tan
 *  segura que la foto se guarda como referencia extra del empleado (aprende
 *  luz, barba, gorra...). Con 0.4 los perfiles registrados con una foto de otra
 *  camara (siempre 0.41-0.49) nunca aprendian y terminaban sin reconocerse. */
export declare const LEARN_MAX_DISTANCE = 0.45;
export declare const LEARN_MIN_MARGIN = 0.1;
/** Referencias guardadas por empleado: la selfie de registro + las aprendidas. */
export declare const MAX_DESCRIPTORS = 10;
/** Fotos de la rafaga que manda el kiosco por marcacion. */
export declare const MAX_PROBES = 3;
/** Dos marcaciones del mismo empleado dentro de esta ventana se toman como una. */
export declare const DUPLICATE_WINDOW_MS: number;
/** Tope absoluto: una entrada abierta de hace mas de esto nunca se cierra con
 *  la marcacion nueva (se asume que olvido marcar la salida). */
export declare const OPEN_SHIFT_MAX_MS: number;
/** Un turno de Horarios que termina tarde (despues del corte del dia) alarga la
 *  vigencia de la entrada hasta su fin mas esto. */
export declare const SHIFT_END_GRACE_MS: number;
/** Hora (Colombia) del dia siguiente a la entrada en la que se corta el dia
 *  laboral: hasta ahi una entrada abierta se cierra con la proxima marcacion. */
export declare const DAY_ROLLOVER_HOUR = 6;
/** Una marcacion de otro dia a menos de esto del inicio de un turno de hoy es
 *  la entrada a ese turno (aunque haya una entrada abierta de ayer). */
export declare const NEW_SHIFT_WINDOW_MS: number;
/** Salida sin entrada: solo desde esto antes del fin del turno... */
export declare const MISSED_IN_BEFORE_END_MS: number;
/** ...hasta esto despues... */
export declare const MISSED_IN_AFTER_END_MS: number;
/** ...y nunca si algun turno del empleado empieza a menos de esto: a esa hora
 *  lo normal es que este llegando (cambio de turno, horario que se movio). */
export declare const MISSED_IN_ARRIVAL_GUARD_MS: number;
/** Una salida sin entrada seguida de otra marcacion del mismo dia laboral al
 *  menos esto despues era en realidad la llegada (cambio de turno que Horarios
 *  no reflejaba): se vuelve entrada y la nueva marcacion es la salida. */
export declare const MISSED_IN_RECLASSIFY_MIN_MS: number;
export declare const DESCRIPTOR_LENGTH = 128;
export type PunchType = 'in' | 'out';
/** Turno programado en Horarios (`companies/{cid}/shifts`). */
export interface ScheduledShift {
    date: string;
    start: string;
    end: string;
}
export interface FaceCandidate {
    employeeId: string;
    employeeName: string;
    descriptors: number[][];
}
export interface MatchResult {
    employeeId: string;
    employeeName: string;
    distance: number;
    /** Distancia del segundo empleado mas cercano (Infinity si no hay otro). */
    secondDistance: number;
    /** Foto de la rafaga que quedo mas cerca (la que se aprende). */
    probe: number[];
}
export declare function euclidean(a: number[], b: number[]): number;
export declare function isValidDescriptor(v: unknown): v is number[];
/** Mejor coincidencia de cada empleado (su referencia mas cercana contra
 *  cualquiera de las fotos de la rafaga) y decision final. Devuelve null si
 *  nadie pasa el umbral o si hay empate. */
export declare function findMatch(probes: number[][], candidates: FaceCandidate[]): MatchResult | null;
/** Si la marcacion es tan clara que la foto se guarda como referencia. */
export declare function shouldLearn(match: MatchResult): boolean;
/**
 * Entrada o salida segun la ultima marcacion del empleado y sus turnos de
 * Horarios (los de los ultimos dias, solo de ese empleado).
 *
 * Horarios no siempre refleja lo que pasa (cambios de turno, dobles, llegadas
 * tarde), asi que pesa mas la historia del propio empleado:
 * - Una entrada abierta del mismo dia laboral (hasta las DAY_ROLLOVER_HOUR del
 *   dia siguiente, tope OPEN_SHIFT_MAX_MS) siempre se cierra. Horarios solo
 *   puede alargar ese corte, nunca acortarlo: quien se queda doble sale bien.
 * - Si la entrada abierta es de otro dia y hoy hay un turno que empieza cerca,
 *   la marcacion es la entrada a ese turno.
 *
 * Sin entrada vigente, la marcacion es entrada salvo que caiga justo al final
 * de un turno al que no marco entrada (`missedIn`): salida sin entrada.
 *
 * Al cambio de turno una llegada y una salida sin entrada se ven iguales. Si
 * despues de una salida sin entrada vuelve a marcar el mismo dia laboral
 * (`reclassifyLast`), esa era la llegada: se vuelve entrada y esta es la salida.
 */
export declare function decidePunch(last: {
    type: PunchType;
    atMs: number;
    missedIn?: boolean;
} | null, nowMs: number, shifts?: ScheduledShift[]): {
    type: PunchType;
    missedIn: boolean;
    reclassifyLast?: true;
};
export declare function nextPunchType(last: {
    type: PunchType;
    atMs: number;
} | null, nowMs: number, shifts?: ScheduledShift[]): PunchType;
/** 'YYYY-MM-DD' en hora de Colombia. */
export declare function bogotaDate(ms: number): string;
export declare function isDuplicate(last: {
    atMs: number;
} | null, nowMs: number): boolean;
/** Agrega un descriptor aprendido. Las referencias de registro (`keep`
 *  primeras) nunca se descartan. Lleno, sale la aprendida mas parecida a la
 *  nueva: asi quedan referencias variadas (luz de dia y de noche, gorra, barba)
 *  y no diez casi iguales del mismo turno. */
export declare function learnDescriptor(descriptors: number[][], probe: number[], keep?: number): number[][];
//# sourceMappingURL=match.d.ts.map