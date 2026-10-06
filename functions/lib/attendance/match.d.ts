/** Distancia euclidiana maxima para aceptar que dos caras son la misma persona.
 *  0.6 es el umbral clasico de face-api; 0.5 es mas estricto y es el que se usa
 *  con una sola selfie de registro para no confundir gente parecida. */
export declare const MATCH_MAX_DISTANCE = 0.5;
/** El segundo candidato tiene que quedar al menos esta distancia mas lejos. Si
 *  dos empleados quedan casi empatados, no se marca a ninguno. */
export declare const MATCH_MIN_MARGIN = 0.06;
/** Por debajo de esta distancia la marcacion es tan clara que el descriptor se
 *  guarda como referencia extra del empleado (aprende luz, barba, gorra...). */
export declare const LEARN_MAX_DISTANCE = 0.4;
/** Referencias guardadas por empleado: la selfie de registro + las aprendidas. */
export declare const MAX_DESCRIPTORS = 6;
/** Dos marcaciones del mismo empleado dentro de esta ventana se toman como una. */
export declare const DUPLICATE_WINDOW_MS: number;
/** Tope absoluto: una entrada abierta de hace mas de esto nunca se cierra con
 *  la marcacion nueva (se asume que olvido marcar la salida). */
export declare const OPEN_SHIFT_MAX_MS: number;
/** Con turno en Horarios, la salida se acepta hasta esto despues del fin del
 *  turno. Pasado eso la entrada queda "sin salida" y la marcacion nueva es
 *  entrada. */
export declare const SHIFT_END_GRACE_MS: number;
/** Sin turno en Horarios: hora (Colombia) del dia siguiente a la entrada en la
 *  que se corta el dia. Un turno que cruza la medianoche cierra hasta esta hora. */
export declare const DAY_ROLLOVER_HOUR = 6;
/** Ventana alrededor de los bordes de un turno: una marcacion de otro dia a
 *  menos de esto del inicio de un turno de hoy es la entrada a ese turno (aunque
 *  haya una entrada abierta de ayer), y a menos de esto del fin puede ser una
 *  salida sin entrada. */
export declare const NEW_SHIFT_WINDOW_MS: number;
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
}
export declare function euclidean(a: number[], b: number[]): number;
export declare function isValidDescriptor(v: unknown): v is number[];
/** Mejor coincidencia de cada empleado (su referencia mas cercana) y decision
 *  final. Devuelve null si nadie pasa el umbral o si hay empate. */
export declare function findMatch(probe: number[], candidates: FaceCandidate[]): MatchResult | null;
/**
 * Entrada o salida segun la ultima marcacion del empleado y sus turnos de
 * Horarios (los de los ultimos dias, solo de ese empleado).
 *
 * Una entrada abierta solo se cierra mientras siga vigente:
 * - con turno: hasta el fin del turno + SHIFT_END_GRACE_MS;
 * - sin turno: hasta las DAY_ROLLOVER_HOUR del dia siguiente a la entrada;
 * - nunca despues de OPEN_SHIFT_MAX_MS.
 * Si la entrada abierta es de otro dia y hoy hay un turno que empieza cerca,
 * la marcacion es la entrada a ese turno.
 *
 * Sin entrada vigente, la marcacion es entrada salvo que caiga en la ventana de
 * salida de un turno al que no marco entrada (`missedIn`): ahi es una salida
 * sin entrada, como hacen los relojes con ventanas de entrada/salida por turno.
 */
export declare function decidePunch(last: {
    type: PunchType;
    atMs: number;
} | null, nowMs: number, shifts?: ScheduledShift[]): {
    type: PunchType;
    missedIn: boolean;
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
/** Agrega un descriptor aprendido. La posicion 0 (selfie de registro) nunca se
 *  descarta; entre las aprendidas sale la mas vieja. */
export declare function learnDescriptor(descriptors: number[][], probe: number[]): number[][];
//# sourceMappingURL=match.d.ts.map