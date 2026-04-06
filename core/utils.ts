/**
 * 精度常量
 * 用于浮点数比较时的误差范围
 */
export const eps = 1e-6;

/**
 * 浮点数比较函数
 * @param a 第一个浮点数
 * @param b 第二个浮点数
 * @returns 是否相等
 * @description 比较两个浮点数是否相等，考虑了精度误差
 */
export function feq(a: number, b: number): boolean {
    return Math.abs(a - b) < eps;
}