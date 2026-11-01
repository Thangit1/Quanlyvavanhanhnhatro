import { z } from "zod";

export const VIETNAM_PHONE_PATTERN = /^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/;
export const PHONE_INVALID_MESSAGE = "Số điện thoại không hợp lệ.";
export const PHONE_REQUIRED_MESSAGE = "Số điện thoại là bắt buộc.";

export type PhoneValidationCode =
  "EMPTY" | "TOO_SHORT" | "TOO_LONG" | "INVALID_PREFIX" | "INVALID_FORMAT";

export type PhoneValidationResult =
  | { valid: true }
  | { valid: false; code: PhoneValidationCode; message: string };

export function isValidVietnamPhone(value: string): boolean {
  return VIETNAM_PHONE_PATTERN.test(value.trim());
}

export function looksLikePhone(value: string): boolean {
  return /^[+\d]/.test(value.trim());
}

export function validateVietnamPhone(
  value: string,
  required = true,
): PhoneValidationResult {
  const phone = value.trim();
  if (!phone) {
    return required
      ? { valid: false, code: "EMPTY", message: PHONE_REQUIRED_MESSAGE }
      : { valid: true };
  }
  if (phone.startsWith("0")) {
    if (!/^\d+$/.test(phone)) {
      return {
        valid: false,
        code: "INVALID_FORMAT",
        message: "Số điện thoại không đúng định dạng.",
      };
    }
    if (phone.length < 10) {
      return {
        valid: false,
        code: "TOO_SHORT",
        message: "Số điện thoại phải có đủ 10 chữ số.",
      };
    }
    if (phone.length > 10) {
      return {
        valid: false,
        code: "TOO_LONG",
        message: "Số điện thoại không được vượt quá 10 chữ số.",
      };
    }
    if (!/^0[35789]/.test(phone)) {
      return {
        valid: false,
        code: "INVALID_PREFIX",
        message: "Đầu số điện thoại không hợp lệ.",
      };
    }
  } else if (phone.startsWith("+84")) {
    if (!/^\+84\d+$/.test(phone) || phone.length !== 12) {
      return {
        valid: false,
        code: phone.length > 12 ? "TOO_LONG" : "INVALID_FORMAT",
        message: "Số điện thoại không đúng định dạng.",
      };
    }
    if (!/^\+84[35789]/.test(phone)) {
      return {
        valid: false,
        code: "INVALID_PREFIX",
        message: "Đầu số điện thoại không hợp lệ.",
      };
    }
  } else {
    return {
      valid: false,
      code: /^\d+$/.test(phone) ? "INVALID_PREFIX" : "INVALID_FORMAT",
      message: /^\d+$/.test(phone)
        ? "Đầu số điện thoại không hợp lệ."
        : "Số điện thoại không đúng định dạng.",
    };
  }
  return isValidVietnamPhone(phone)
    ? { valid: true }
    : { valid: false, code: "INVALID_FORMAT", message: PHONE_INVALID_MESSAGE };
}

export const optionalVietnamPhoneSchema = z
  .string()
  .trim()
  .superRefine((value, context) => {
    const result = validateVietnamPhone(value, false);
    if (result.valid) return;
    context.addIssue({ code: "custom", message: result.message });
  });

export const requiredVietnamPhoneSchema = z
  .string()
  .trim()
  .superRefine((value, context) => {
    const result = validateVietnamPhone(value);
    if (result.valid) return;
    context.addIssue({ code: "custom", message: result.message });
  });

export const emailOrVietnamPhoneSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập email hoặc số điện thoại.")
  .superRefine((value, context) => {
    if (!value) return;
    if (z.string().email().safeParse(value).success) return;
    const phoneResult = validateVietnamPhone(value);
    if (phoneResult.valid) return;
    context.addIssue({
      code: "custom",
      message: looksLikePhone(value)
        ? phoneResult.message
        : "Email hoặc số điện thoại không hợp lệ.",
    });
  });
