'use client'
import { useState } from "react";
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getThemeCssVars } from '@/lib/theme'


interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[]; // only for 'select'
}

const FIELD_TYPE_LABELS: Record<FormField['type'], string> = {
  text: 'Short text',
  textarea: 'Long text',
  select: 'Dropdown',
  checkbox: 'Checkbox',
}

export default function IntakeFormBuilder({
  initialFields,
  themeColor,
  themeSurface,
}: {
  initialFields: FormField[]
  themeColor?: string | null
  themeSurface?: string | null
}) {
  const router = useRouter()
  const [fields, setFields] = useState<FormField[]>(initialFields)

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');


  const addField = () => {
    setFields([
      ...fields,
      { id: crypto.randomUUID(), label: '', type: 'text', required: false },
    ]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const handleSave = async () => {
    setStatus('saving');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('trainers')
      .update({ intake_form_schema: fields })
      .eq('auth_user_id', user.id);

    setStatus(error ? 'idle' : 'saved');
  };

  return (
    <div className="blocs-theme blocs-page" style={getThemeCssVars(themeColor, themeSurface)}>
      <div className="blocs-form-shell flex flex-col gap-5" style={{ padding: '32px 24px' }}>
        <button className="blocs-day-chip" onClick={() => router.push('/dashboard')} style={{ padding: '8px 16px', alignSelf: 'flex-start' }}>
          ← Back to dashboard
        </button>

        <div className="flex flex-col gap-1.5">
          <h1 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Client intake form
          </h1>
          <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13px' }}>
            Shown to new clients the first time they book with you. Returning clients skip this.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {fields.map((field) => (
            <div
              key={field.id}
              className="flex flex-col gap-3"
              style={{ background: 'var(--blocs-input-bg)', border: '1px solid var(--blocs-border-soft)', borderRadius: '14px', padding: '16px' }}
            >
              <div className="flex gap-2 flex-wrap">
                <input
                  className="blocs-input"
                  style={{ flex: '1 1 200px' }}
                  placeholder="Question"
                  value={field.label}
                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                />
                <select
                  className="blocs-select"
                  style={{ flex: '0 0 160px' }}
                  value={field.type}
                  onChange={(e) => updateField(field.id, { type: e.target.value as FormField['type'] })}
                >
                  {(Object.keys(FIELD_TYPE_LABELS) as FormField['type'][]).map((type) => (
                    <option key={type} value={type}>{FIELD_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </div>

              {field.type === 'select' && (
                <input
                  className="blocs-input"
                  placeholder="Options, comma separated"
                  value={field.options?.join(', ') ?? ''}
                  onChange={(e) =>
                    updateField(field.id, { options: e.target.value.split(',').map((s) => s.trim()) })
                  }
                />
              )}

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2" style={{ color: 'var(--blocs-text-60)', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(field.id, { required: e.target.checked })}
                  />
                  Required
                </label>
                <button className="blocs-slot-action-danger" onClick={() => removeField(field.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}

          {fields.length === 0 && (
            <p style={{ margin: 0, color: 'var(--blocs-text-40)', fontSize: '13px' }}>
              No questions yet — add one below.
            </p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <button className="blocs-btn-secondary" style={{ flex: '0 0 auto', padding: '13px 18px' }} onClick={addField}>
            + Add question
          </button>
          <button
            className="blocs-btn-primary"
            style={{ flex: '0 0 auto', padding: '13px 18px' }}
            onClick={handleSave}
            disabled={status === 'saving'}
          >
            {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved!' : 'Save form'}
          </button>
        </div>
      </div>
    </div>
  );
}
