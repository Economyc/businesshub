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
/** Si la ultima marcacion fue una entrada hace mas de esto, se asume que olvido
 *  marcar la salida y la nueva vuelve a ser entrada. Cubre turnos que cruzan la
 *  medianoche sin confundir dias distintos. */
export declare const OPEN_SHIFT_MAX_MS: number;
export declare const DESCRIPTOR_LENGTH = 128;
export type PunchType = 'in' | 'out';
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
/** Entrada o salida segun la ultima marcacion del empleado. */
export declare function nextPunchType(last: {
    type: PunchType;
    atMs: number;
} | null, nowMs: number): PunchType;
export declare function isDuplicate(last: {
    atMs: number;
} | null, nowMs: number): boolean;
/** Agrega un descriptor aprendido. La posicion 0 (selfie de registro) nunca se
 *  descarta; entre las aprendidas sale la mas vieja. */
export declare function learnDescriptor(descriptors: number[][], probe: number[]): number[][];
//# sourceMappingURL=match.d.ts.map