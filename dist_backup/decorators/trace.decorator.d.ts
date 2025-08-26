export interface TraceOptions {
    alertOnError?: boolean;
    alertOnCriticalError?: boolean;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    businessImpact?: 'low' | 'medium' | 'high' | 'critical';
    userAffected?: boolean;
    customContext?: Record<string, any>;
    spanName?: string;
    includeArgs?: boolean;
    includeUserContext?: boolean;
    includeHttpContext?: boolean;
}
export declare function Trace(options?: TraceOptions | string): (target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare function TraceAsync(spanName: string): (target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
