import { clsx, type ClassValue } from "clsx";

/** Join class names conditionally. */
export const cn = (...inputs: ClassValue[]): string => clsx(inputs);
