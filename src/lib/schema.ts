import { z } from "zod";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB hard ceiling enforced on the server, per image
export const CLIENT_TARGET_BYTES = 4 * 1024 * 1024; // client compresses toward this before upload
export const MAX_IMAGES = 10;

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const contactFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(100, "Name is too long"),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a valid phone number")
    .max(20, "Phone number is too long")
    .regex(/^[0-9+()\-.\s]+$/, "Phone number contains invalid characters"),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
  address: z
    .string()
    .trim()
    .min(5, "Please enter the site address")
    .max(300, "Address is too long"),
  // Honeypot: real users never fill this in. Any value here means a bot.
  website: z.string().max(0, "Spam detected").optional().default(""),
  // Timestamp (ms) the form was rendered, used to reject submissions that
  // complete implausibly fast for a human filling four fields.
  renderedAt: z.coerce.number().int().positive(),
});

export type ContactFields = z.infer<typeof contactFieldsSchema>;
