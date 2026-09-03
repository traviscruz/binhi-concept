import { useState } from 'react';
import type { FormEvent } from 'react';

import { MonoBadge } from '../../components/shared/Badges';
import { IconCheck, IconMail, IconClock } from '../../components/shared/icons';
import { supabase } from '../../utils/supabase';
import { sendInquiryEmails } from '../../utils/emailService';

type ContactErrors = Partial<Record<'name' | 'email' | 'eventType' | 'message', string>>;

export default function ContactPage() {
  const [values, setValues] = useState({
    name: '',
    email: '',
    website: '',
    eventType: '',
    eventDate: '',
    budget: '',
    message: '',
  });
  const [errors, setErrors] = useState<ContactErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [emailStatusNote, setEmailStatusNote] = useState<string | null>(null);

  const validate = (v: typeof values): ContactErrors => {
    const e: ContactErrors = {};
    if (!v.name.trim()) e.name = 'Tell us your name.';
    if (!v.email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'That email doesn\u2019t look right.';
    if (!v.eventType) e.eventType = 'Select the kind of event.';
    if (!v.message.trim()) e.message = 'Let us know what you need.';
    else if (v.message.trim().length < 10) e.message = 'A few more details would help (10+ characters).';
    return e;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const eErrors = validate(values);
    setErrors(eErrors);
    setTouched({ name: true, email: true, eventType: true, message: true });

    if (Object.keys(eErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Save to Supabase 'inquiries' table
      const { error: dbError } = await supabase.from('inquiries').insert([
        {
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          website: values.website.trim() || null,
          event_type: values.eventType,
          event_date: values.eventDate || null,
          budget: values.budget.trim() || null,
          message: values.message.trim(),
          status: 'New',
        },
      ]);

      if (dbError) {
        console.error('[ContactPage] Database insert error:', dbError);
        setSubmitError('Failed to save your inquiry. Please check your connection and try again.');
        setSubmitting(false);
        return;
      }

      // 2. Dispatch Confirmation and Admin Alert Emails
      try {
        const emailResult = await sendInquiryEmails({
          name: values.name.trim(),
          email: values.email.trim(),
          eventType: values.eventType,
          eventDate: values.eventDate || undefined,
          budget: values.budget.trim() || undefined,
          website: values.website.trim() || undefined,
          message: values.message.trim(),
        });

        if (emailResult.customerSent) {
          setEmailStatusNote(`A confirmation email with your event details was sent to ${values.email}.`);
        } else {
          setEmailStatusNote(`Your inquiry was recorded successfully! Our team will reach out to ${values.email} soon.`);
        }
      } catch (emailErr) {
        console.warn('[ContactPage] Email dispatch warning:', emailErr);
        setEmailStatusNote(`Your inquiry was recorded successfully! Our team will reach out to ${values.email} soon.`);
      }

      setSent(true);
    } catch (err: any) {
      console.error('[ContactPage] Unexpected error:', err);
      setSubmitError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setValues({
      name: '',
      email: '',
      website: '',
      eventType: '',
      eventDate: '',
      budget: '',
      message: '',
    });
    setErrors({});
    setTouched({});
    setSubmitError(null);
    setSent(false);
  };

  const inputClass = (hasError?: boolean) =>
    `w-full rounded-full border px-5 py-3.5 text-[15px] bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] transition-colors ${
      hasError ? 'border-rose-400' : 'border-transparent'
    }`;

  if (sent) {
    return (
      <section className="pt-36 sm:pt-44 pb-24 px-4 sm:px-6 min-h-[75vh] flex items-center justify-center">
        <div className="max-w-lg w-full text-center">
          <div className="bg-[var(--mist)] rounded-[2.25rem] p-8 sm:p-10 border border-[#24252c]/[0.08] shadow-sm">
            <span className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
              <IconCheck className="w-7 h-7" />
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-6 text-[var(--ink)]">
              Inquiry Submitted!
            </h2>
            <p className="text-[#24252c]/65 mt-3 text-sm leading-relaxed max-w-sm mx-auto">
              {emailStatusNote || `Thank you ${values.name}. We'll get back to you at ${values.email} within 24 hours.`}
            </p>

            <div className="mt-6 p-4 rounded-2xl bg-white border border-[#24252c]/[0.06] text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#24252c]/50 font-bold uppercase text-[10px]">Client</span>
                <span className="font-semibold text-[var(--ink)]">{values.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#24252c]/50 font-bold uppercase text-[10px]">Event Type</span>
                <span className="font-semibold text-[var(--ink)]">{values.eventType}</span>
              </div>
              {values.eventDate && (
                <div className="flex justify-between">
                  <span className="text-[#24252c]/50 font-bold uppercase text-[10px]">Target Date</span>
                  <span className="font-semibold text-[var(--ink)]">{values.eventDate}</span>
                </div>
              )}
              {values.budget && (
                <div className="flex justify-between">
                  <span className="text-[#24252c]/50 font-bold uppercase text-[10px]">Est. Budget</span>
                  <span className="font-semibold text-[var(--ink)]">{values.budget}</span>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={resetForm}
                className="px-6 py-3 rounded-full bg-[var(--ink)] text-white text-xs font-semibold hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
              >
                Send another inquiry
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-28 sm:pt-36 md:pt-40 pb-20 sm:pb-24 px-4 sm:px-6">
      <div className="max-w-xl mx-auto text-center">
        <MonoBadge icon={IconMail}>Contact Us</MonoBadge>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mt-4 leading-[1.03] text-[var(--ink)]">
          Got an event?<br />We're here to help.
        </h1>
        <p className="text-xs sm:text-sm text-[#24252c]/60 mt-3 max-w-md mx-auto">
          Tell us about your upcoming occasion. Our event specialists will craft the perfect audio, lighting, and stage setup.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="max-w-xl mx-auto mt-8 bg-[var(--mist)] rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.06] shadow-sm">
        {submitError && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
            {submitError}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <input
              autoFocus
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              placeholder="Full name *"
              disabled={submitting}
              className={inputClass(touched.name && !!errors.name)}
            />
            {touched.name && errors.name && (
              <p className="text-[11px] text-rose-500 mt-1 ml-4">{errors.name}</p>
            )}
          </div>
          <div>
            <input
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
              placeholder="Your email address *"
              disabled={submitting}
              className={inputClass(touched.email && !!errors.email)}
            />
            {touched.email && errors.email && (
              <p className="text-[11px] text-rose-500 mt-1 ml-4">{errors.email}</p>
            )}
          </div>
        </div>

        <div className="mt-3">
          <input
            value={values.website}
            onChange={(e) => setValues({ ...values, website: e.target.value })}
            placeholder="Website / social link (optional)"
            disabled={submitting}
            className={inputClass()}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <div>
            <select
              value={values.eventType}
              onChange={(e) => setValues({ ...values, eventType: e.target.value })}
              disabled={submitting}
              className={`${inputClass(touched.eventType && !!errors.eventType)} ${!values.eventType ? 'text-[#24252c]/40' : ''}`}
            >
              <option value="">Type of event *</option>
              <option>Wedding Reception</option>
              <option>18th Birthday Debut</option>
              <option>Corporate Event / Gala</option>
              <option>Concert / Live Music</option>
              <option>School / University Event</option>
              <option>Church / Religious Gathering</option>
              <option>Other</option>
            </select>
            {touched.eventType && errors.eventType && (
              <p className="text-[11px] text-rose-500 mt-1 ml-4">{errors.eventType}</p>
            )}
          </div>
          <div>
            <input
              type="date"
              value={values.eventDate}
              onChange={(e) => setValues({ ...values, eventDate: e.target.value })}
              disabled={submitting}
              className={inputClass()}
            />
          </div>
        </div>

        <div className="mt-3">
          <input
            value={values.budget}
            onChange={(e) => setValues({ ...values, budget: e.target.value })}
            placeholder="Estimated budget (e.g. ₱35,000) (optional)"
            disabled={submitting}
            className={inputClass()}
          />
        </div>

        <div className="mt-3">
          <textarea
            value={values.message}
            onChange={(e) => setValues({ ...values, message: e.target.value })}
            placeholder="Tell us about your event, venue, guest count, and gear requirements... *"
            rows={4}
            disabled={submitting}
            className={`w-full rounded-[1.75rem] border px-5 py-4 text-[15px] bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] transition-colors text-[var(--ink)] ${
              touched.message && errors.message ? 'border-rose-400' : 'border-transparent'
            }`}
          />
          {touched.message && errors.message && (
            <p className="text-[11px] text-rose-500 mt-1 ml-4">{errors.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full bg-[var(--ink)] text-white font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
        >
          {submitting ? (
            <>
              <IconClock className="w-4 h-4 animate-spin" />
              <span>Sending inquiry...</span>
            </>
          ) : (
            <span>Send message</span>
          )}
        </button>

        <p className="text-center text-[11px] text-[#24252c]/50 mt-3">
          We respect your privacy. Inquiries are stored securely and answered within 24 hours.
        </p>
      </form>
    </section>
  );
}