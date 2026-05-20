import type { Timestamp } from 'firebase-admin/firestore';
export declare function bogotaParts(d: Date): {
    year: number;
    monthIndex: number;
};
export declare function ymKey(year: number, monthIndex: number): string;
export declare function ymKeyFromTs(ts: Timestamp | undefined): string | null;
export declare function currentYm(): {
    year: number;
    monthIndex: number;
    key: string;
};
export declare function inMonthBogota(ts: Timestamp | undefined, year: number, monthIndex: number): boolean;
export declare function isCurrentMonthBogota(year: number, monthIndex: number): boolean;
//# sourceMappingURL=month.d.ts.map