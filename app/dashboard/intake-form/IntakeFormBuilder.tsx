'use client'
import { useState, useEffect } from "react";
import { supabase } from '@/lib/supabase'


interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[]; // only for 'select'
}


export default function IntakeFormBuilder({
  initialFields,
}: {
  initialFields: FormField[]
}) {
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
    <div>
      <h1>Client Intake Form</h1>
      <p>Shown to new clients the first time they book with you. Returning clients skip this.</p>

      {fields.map((field) => (
        <div key={field.id} style={{ border: '1px solid #ddd', padding: '12px', marginBottom: '8px' }}>
          <input
            placeholder="Question"
            value={field.label}
            onChange={(e) => updateField(field.id, { label: e.target.value })}
          />
          <select
            value={field.type}
            onChange={(e) => updateField(field.id, { type: e.target.value as FormField['type'] })}
          >
            <option value="text">Short text</option>
            <option value="textarea">Long text</option>
            <option value="select">Dropdown</option>
            <option value="checkbox">Checkbox</option>
          </select>

          {field.type === 'select' && (
            <input
              placeholder="Options, comma separated"
              value={field.options?.join(', ') ?? ''}
              onChange={(e) =>
                updateField(field.id, { options: e.target.value.split(',').map((s) => s.trim()) })
              }
            />
          )}

          <label>
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => updateField(field.id, { required: e.target.checked })}
            />
            Required
          </label>

          <button onClick={() => removeField(field.id)}>Remove</button>
        </div>
      ))}

      <button onClick={addField}>+ Add question</button>
      <button onClick={handleSave} disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved!' : 'Save form'}
      </button>
    </div>
  );
}