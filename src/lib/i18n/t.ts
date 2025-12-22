import { messages, type MessageKey, type SupportedLocale } from "./messages";

export function t(locale: SupportedLocale, key: MessageKey): string {
  return messages[locale][key] ?? messages.en[key] ?? key;
}

