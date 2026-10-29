/**
 * WhatsApp SpinTax Parser & Message Variation Engine
 *
 * WhatsApp algorithms flag identical broadcast messages as spam. SpinTax syntax:
 *   "{Hi|Hello|வணக்கம்} {{name}}! {Thank you for contacting us|Thanks for reaching out}."
 *
 * This engine recursively evaluates nested and flat SpinTax blocks, selecting a randomized
 * alternative for each bracketed segment to ensure no two messages share the exact same fingerprint.
 */

export function resolveSpinTax(text: string | null | undefined): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // Fast path: if no brackets present, return original
  if (!text.includes("{") || !text.includes("}")) {
    return text;
  }

  // Matches innermost {option1|option2|option3} blocks
  const innerSpinRegex = /\{([^{}]+)\}/g;
  let current = text;
  let iterations = 0;
  const maxIterations = 10; // Guard against malformed cyclic brackets

  while (innerSpinRegex.test(current) && iterations < maxIterations) {
    current = current.replace(innerSpinRegex, (_, choices: string) => {
      const options = choices.split("|");
      const chosen = options[Math.floor(Math.random() * options.length)];
      return chosen !== undefined ? chosen : "";
    });
    iterations++;
  }

  return current;
}
