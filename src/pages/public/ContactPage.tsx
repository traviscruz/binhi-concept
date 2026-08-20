import { useState } from 'react';
import type { FormEvent } from 'react';

import { MonoBadge } from '../../components/shared/Badges';
import { IconCheck, IconMail } from '../../components/shared/icons';

type ContactErrors = Partial<Record<'name' | 'email' | 'eventType' | 'message', string>>;

export default function ContactPage() {
  const [values, setValues] = useState({ name: '', email: '', website: '', eventType: '', eventDate: '', budget: '', message: '' });
  const [errors, setErrors] = useState<ContactErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState(false);

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const eErrors = validate(values);
    setErrors(eErrors);
    setTouched({ name: true, email: true, eventType: true, message: true });
    if (Object.keys(eErrors).length === 0) setSent(true);
  };

  const inputClass = (hasError?: boolean) =>
    `w-full rounded-full border px-5 py-3.5 text-[15px] bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors ${
      hasError ? 'border-rose-400' : 'border-transparent'
    }`;

  if (sent) {
    return (
      <section className="pt-44 pb-24 px-6 min-h-[70vh] flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="ticket-notch ticket-dash bg-[var(--mist)] rounded-[1.75rem] p-8">
            <span className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto">
              <IconCheck className="w-6 h-6" />
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight mt-5">Message sent</h2>
            <p className="text-[#24252c]/55 mt-2 text-sm leading-relaxed">
              We'll get back to you at <span className="font-medium text-[var(--ink)]">{values.email}</span> within 24 hours.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-28 sm:pt-36 md:pt-40 pb-20 sm:pb-24 px-4 sm:px-6">
      <div className="max-w-xl mx-auto text-center">
        <MonoBadge icon={IconMail}>Contact</MonoBadge>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mt-4 leading-[1.03]">Got an event?<br />We're here to help.</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="max-w-xl mx-auto mt-10 bg-[var(--mist)] rounded-[2rem] p-6 md:p-8">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <input
              autoFocus
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              placeholder="Full name"
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
              placeholder="Your email address"
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
            className={inputClass()}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <div>
            <select
              value={values.eventType}
              onChange={(e) => setValues({ ...values, eventType: e.target.value })}
              className={`${inputClass(touched.eventType && !!errors.eventType)} ${!values.eventType ? 'text-[#24252c]/40' : ''}`}
            >
              <option value="">Type of event</option>
              <option>Wedding Reception</option>
              <option>18th Birthday Debut</option>
              <option>Corporate Event / Gala</option>
              <option>Concert / Live Music</option>
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
              className={inputClass()}
            />
          </div>
        </div>

        <div className="mt-3">
          <input
            value={values.budget}
            onChange={(e) => setValues({ ...values, budget: e.target.value })}
            placeholder="Estimated budget (optional)"
            className={inputClass()}
          />
        </div>

        <div className="mt-3">
          <textarea
            value={values.message}
            onChange={(e) => setValues({ ...values, message: e.target.value })}
            placeholder="Tell us about your event..."
            rows={4}
            className={`w-full rounded-[1.75rem] border px-5 py-4 text-[15px] bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors ${
              touched.message && errors.message ? 'border-rose-400' : 'border-transparent'
            }`}
          />
          {touched.message && errors.message && (
            <p className="text-[11px] text-rose-500 mt-1 ml-4">{errors.message}</p>
          )}
        </div>

        <button type="submit" className="mt-5 w-full bg-[var(--ink)] text-white font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
          Send message
        </button>
      </form>
    </section>
  );
}