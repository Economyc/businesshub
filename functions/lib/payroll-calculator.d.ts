export declare const SMLMV = 1423500;
export declare const AUXILIO_TRANSPORTE = 200000;
export declare const SALUD_EMPLEADO = 0.04;
export declare const PENSION_EMPLEADO = 0.04;
export declare const OVERTIME_RATES: {
    readonly diurna: 1.25;
    readonly nocturna: 1.75;
    readonly dominical_diurna: 2;
    readonly dominical_nocturna: 2.5;
};
export type OvertimeType = keyof typeof OVERTIME_RATES;
export interface OvertimeEntry {
    type: OvertimeType;
    hours: number;
}
export interface PayrollDeduction {
    concept: string;
    percentage?: number;
    amount: number;
}
export interface PayrollItem {
    employeeId: string;
    employeeName: string;
    employeeIdentification: string;
    employeeRole: string;
    employeeDepartment: string;
    baseSalary: number;
    auxilioTransporte: number;
    overtime: OvertimeEntry[];
    overtimeTotal: number;
    additionalDeductions: PayrollDeduction[];
    healthDeduction: number;
    pensionDeduction: number;
    totalDeductions: number;
    totalEarnings: number;
    netPay: number;
}
/**
 * Calcula la nómina de un empleado a partir de datos raw de Firestore.
 * Compatible con el formato Record<string, unknown> del Admin SDK.
 */
export declare function calculatePayrollItemFromRaw(employee: Record<string, unknown>, overtime?: OvertimeEntry[], additionalDeductions?: PayrollDeduction[]): PayrollItem;
export declare function calculatePayrollTotals(items: PayrollItem[]): {
    totalBaseSalary: number;
    totalAuxilio: number;
    totalOvertime: number;
    totalDeductions: number;
    totalEarnings: number;
    totalNetPay: number;
    employeeCount: number;
};
//# sourceMappingURL=payroll-calculator.d.ts.map