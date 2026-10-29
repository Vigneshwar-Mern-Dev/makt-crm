"use client";

import { useEffect, useState, use } from "react";
import { markFormOpenedAction, markFormStartedAction, submitFormAction } from "./actions";

const translations = {
  ta: {
    title: "தொடர்பு விவரங்கள்",
    subtitle: "MAKT ATM Franchise பற்றி எங்கள் குழு உங்களுக்கு உதவ கீழே உங்கள் விவரங்களை வழங்கவும்.",
    fullName: "முழு பெயர்",
    namePlaceholder: "எ.கா. ராமேஷ் குமார்",
    city: "நகரம் / இடம்",
    cityPlaceholder: "எ.கா. சென்னை",
    propertyType: "சொத்து வகை",
    ownProperty: "சொந்த சொத்து",
    rentalProperty: "வாடகை சொத்து",
    mapsLocation: "Google Maps இருப்பிடம்",
    openMaps: "📍 Maps திற",
    mapsPlaceholder: "Google Maps லிங்கை இங்கே ஒட்டவும்...",
    submit: "விவரங்களை சமர்ப்பிக்கவும்",
    submitting: "சமர்ப்பிக்கிறது...",
    thankYou: "நன்றி! 🙏",
    successMessage: "உங்கள் விவரங்கள் வெற்றிகரமாக பெறப்பட்டன. எங்கள் குழு விரைவில் உங்களைத் தொடர்பு கொள்ளும்.",
    required: "*",
    errorDefault: "எதிர்பாராத பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.",
    langSwitch: "English",
    langFlag: "🇬🇧",
  },
  en: {
    title: "Contact Details",
    subtitle: "Please provide your details below so our team can assist you with the MAKT ATM Franchise.",
    fullName: "Full Name",
    namePlaceholder: "e.g. Ramesh Kumar",
    city: "City / Location",
    cityPlaceholder: "e.g. Chennai",
    propertyType: "Property Type",
    ownProperty: "Own Property",
    rentalProperty: "Rental Property",
    mapsLocation: "Google Maps Location",
    openMaps: "📍 Open Maps",
    mapsPlaceholder: "Paste Google Maps link here...",
    submit: "Submit Details",
    submitting: "Submitting...",
    thankYou: "Thank You!",
    successMessage: "Your details have been received successfully. Our team will contact you shortly.",
    required: "*",
    errorDefault: "An unexpected error occurred. Please try again.",
    langSwitch: "தமிழ்",
    langFlag: "🇮🇳",
  },
} as const;

type Lang = keyof typeof translations;

export default function LeadFormPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedTracked, setStartedTracked] = useState(false);
  const [lang, setLang] = useState<Lang>("ta");

  const t = translations[lang];

  useEffect(() => {
    markFormOpenedAction(resolvedParams.token).catch(() => {});
  }, [resolvedParams.token]);

  function trackStarted() {
    if (startedTracked) {
      return;
    }

    setStartedTracked(true);
    markFormStartedAction(resolvedParams.token).catch(() => {});
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    
    try {
      const res = await submitFormAction(resolvedParams.token, formData);
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(res.error || t.errorDefault);
      }
    } catch {
      setError(t.errorDefault);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-3xl text-emerald-400">
          ✓
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t.thankYou}</h1>
        <p className="mt-2 text-slate-400">
          {t.successMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm sm:p-8">
      {/* Language Toggle */}
      <div className="mb-6 flex justify-end">
        <button
          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-300"
          onClick={() => setLang(lang === "ta" ? "en" : "ta")}
          type="button"
        >
          <span className="text-base leading-none">{t.langFlag}</span>
          {t.langSwitch}
        </button>
      </div>

      <div className="mb-8">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 font-bold text-cyan-400">
          MAKT
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {t.subtitle}
        </p>
      </div>

      <form className="space-y-6" onChange={trackStarted} onFocus={trackStarted} onSubmit={handleSubmit}>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">
              {t.fullName} <span className="text-rose-400">{t.required}</span>
            </span>
            <input
              required
              className="h-12 w-full rounded-xl border border-white/10 bg-black/50 px-4 text-white outline-none focus:border-cyan-400 focus:bg-white/5 focus:ring-1 focus:ring-cyan-400"
              maxLength={120}
              name="name"
              placeholder={t.namePlaceholder}
              type="text"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">
              {t.city} <span className="text-rose-400">{t.required}</span>
            </span>
            <input
              required
              className="h-12 w-full rounded-xl border border-white/10 bg-black/50 px-4 text-white outline-none focus:border-cyan-400 focus:bg-white/5 focus:ring-1 focus:ring-cyan-400"
              maxLength={120}
              name="city"
              placeholder={t.cityPlaceholder}
              type="text"
            />
          </label>

          <div className="block">
            <span className="mb-3 block text-sm font-medium text-slate-300">
              {t.propertyType} <span className="text-rose-400">{t.required}</span>
            </span>
            <div className="grid grid-cols-2 gap-3">
              <label className="relative flex cursor-pointer rounded-xl border border-white/10 bg-black/50 p-4 transition-colors hover:bg-white/5 has-[:checked]:border-cyan-400 has-[:checked]:bg-cyan-400/10">
                <input required className="peer sr-only" name="propertyType" type="radio" value="OWN" />
                <div className="flex flex-col">
                  <span className="text-xl">🏠</span>
                  <span className="mt-2 font-medium text-white">{t.ownProperty}</span>
                </div>
              </label>
              <label className="relative flex cursor-pointer rounded-xl border border-white/10 bg-black/50 p-4 transition-colors hover:bg-white/5 has-[:checked]:border-cyan-400 has-[:checked]:bg-cyan-400/10">
                <input required className="peer sr-only" name="propertyType" type="radio" value="RENTAL" />
                <div className="flex flex-col">
                  <span className="text-xl">🔑</span>
                  <span className="mt-2 font-medium text-white">{t.rentalProperty}</span>
                </div>
              </label>
            </div>
          </div>

          <label className="block">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">
                {t.mapsLocation} <span className="text-rose-400">{t.required}</span>
              </span>
              <a
                className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline"
                href="https://maps.google.com"
                rel="noopener noreferrer"
                target="_blank"
              >
                {t.openMaps}
              </a>
            </div>
            <textarea
              required
              className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/50 p-4 text-white outline-none focus:border-cyan-400 focus:bg-white/5 focus:ring-1 focus:ring-cyan-400"
              maxLength={2048}
              name="mapsLocation"
              placeholder={t.mapsPlaceholder}
            />
          </label>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        <button
          className="relative h-12 w-full overflow-hidden rounded-xl bg-cyan-400 px-6 font-bold text-slate-900 transition-all hover:bg-cyan-300 disabled:opacity-70"
          disabled={submitting}
          type="submit"
        >
          {submitting ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}
