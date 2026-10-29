import { resolveSpinTax } from "./whatsapp-spintax";

const DEFAULT_MESSAGE = `{வணக்கம்|ஹலோ|Hi} {{name}}! 🙏

{ATM Franchise-ஐ தொடர்பு கொண்டதற்கு நன்றி|MAKT ATM Franchise பற்றி விசாரித்தமைக்கு நன்றி}.

{உங்கள் விவரங்களை இந்த பாதுகாப்பான லிங்க் மூலம் பூர்த்தி செய்யுங்கள்|கீழே உள்ள லிங்கை கிளிக் செய்து விவரங்களை பதிவு செய்யவும்}:
👉 {{formLink}}

{எங்கள் குழு உங்கள் விவரங்களை ஆய்வு செய்து விரைவில் உங்களைத் தொடர்பு கொள்ளும்|எங்கள் அணி விரைவில் உங்களை அழைத்து முழு விவரங்களையும் வழங்கும்}.
{நன்றி! 🙏|நன்றி 😊}`;

export function renderWhatsAppMessage(
  template: string | null | undefined,
  name: string,
  formLink: string,
) {
  const selectedTemplate = template?.trim() || DEFAULT_MESSAGE;
  const withSpinTax = resolveSpinTax(selectedTemplate);
  const rendered = withSpinTax
    .replaceAll("{{name}}", name)
    .replaceAll("{{formLink}}", formLink)
    .trim();

  if (!formLink || rendered.includes(formLink)) {
    return rendered;
  }

  return `${rendered}

உங்கள் விவரங்களை இந்த பாதுகாப்பான லிங்க் மூலம் பூர்த்தி செய்யுங்கள்:
👉 ${formLink}`;
}
