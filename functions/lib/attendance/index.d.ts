import { type PunchType } from './match.js';
export declare const attendanceKioskLink: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    token: string;
}>, unknown>;
export declare const attendanceKioskInfo: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    companyName: string;
    location: string | null;
    logo: string | null;
    logoThumb: string | null;
    color: string | null;
}>, unknown>;
export declare const attendancePunch: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    matched: false;
    duplicate?: undefined;
    employeeName?: undefined;
    type?: undefined;
    at?: undefined;
    punchId?: undefined;
} | {
    matched: true;
    duplicate: boolean;
    employeeName: string;
    type: PunchType;
    at: string;
    punchId: string | null;
}>, unknown>;
export declare const attendanceFlipPunch: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    type: PunchType;
}>, unknown>;
//# sourceMappingURL=index.d.ts.map