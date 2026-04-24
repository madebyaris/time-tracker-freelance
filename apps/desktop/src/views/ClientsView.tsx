import { useRef, useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Avatar,
  Button,
  Combobox,
  EmptyState,
  Field,
  FieldLabel,
  Input,
  Textarea,
} from '@ttf/ui';
import { BriefcaseBusiness, Plus } from 'lucide-react';
import { Clients, type Client } from '../db/repos';
import { staticQueryOptions } from '../lib/query-client';
import { encodeLogo } from '../lib/encode-logo';

const currencies = ['USD', 'EUR', 'GBP', 'IDR', 'JPY', 'CAD', 'AUD'];
const currencyOptions = currencies.map((c) => ({ value: c, label: c }));

interface ClientFormState {
  name: string;
  email: string;
  website: string;
  phone: string;
  address: string;
  taxId: string;
  hourlyRate: string;
  currency: string | null;
  logoData: string | null;
}

const EMPTY_FORM: ClientFormState = {
  name: '',
  email: '',
  website: '',
  phone: '',
  address: '',
  taxId: '',
  hourlyRate: '',
  currency: 'USD',
  logoData: null,
};

function centsToDecimal(cents: number | null): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

function decimalToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function fromClient(client: Client): ClientFormState {
  return {
    name: client.name,
    email: client.email ?? '',
    website: client.website ?? '',
    phone: client.phone ?? '',
    address: client.address ?? '',
    taxId: client.tax_id ?? '',
    hourlyRate: centsToDecimal(client.default_hourly_rate_cents),
    currency: client.currency,
    logoData: client.logo_data,
  };
}

function toCreatePayload(state: ClientFormState) {
  return {
    name: state.name.trim(),
    email: state.email.trim() || null,
    currency: state.currency ?? 'USD',
    website: state.website.trim() || null,
    phone: state.phone.trim() || null,
    address: state.address.trim() || null,
    tax_id: state.taxId.trim() || null,
    default_hourly_rate_cents: decimalToCents(state.hourlyRate),
    logo_data: state.logoData,
  };
}

function toUpdatePayload(state: ClientFormState) {
  return {
    name: state.name.trim(),
    email: state.email.trim() || null,
    currency: state.currency ?? 'USD',
    website: state.website.trim() || null,
    phone: state.phone.trim() || null,
    address: state.address.trim() || null,
    tax_id: state.taxId.trim() || null,
    default_hourly_rate_cents: decimalToCents(state.hourlyRate),
    logo_data: state.logoData,
  };
}

export function ClientsView() {
  const qc = useQueryClient();
  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: () => Clients.list(),
    ...staticQueryOptions,
  });
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<ClientFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ClientFormState>(EMPTY_FORM);

  const create = useMutation({
    mutationFn: () => Clients.create(toCreatePayload(createForm)),
    onSuccess: () => {
      resetCreateForm();
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
  const update = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error('Select a client to edit');
      return Clients.update(editingId, toUpdatePayload(editForm));
    },
    onSuccess: () => {
      resetEditForm();
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const clients = clientsQ.data ?? [];

  function resetCreateForm() {
    create.reset();
    setCreateForm(EMPTY_FORM);
    setCreating(false);
  }

  function resetEditForm() {
    update.reset();
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }

  function openEditForm(client: Client) {
    resetCreateForm();
    setEditForm(fromClient(client));
    setEditingId(client.id);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Clients
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {clients.length} {clients.length === 1 ? 'client' : 'clients'}
          </h1>
        </div>
        {!creating && (
          <Button variant="primary" size="md" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" />
            New client
          </Button>
        )}
      </header>

      {creating && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <ClientFormFields value={createForm} onChange={setCreateForm} idPrefix="client-create" />
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={resetCreateForm}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => create.mutate()}
              disabled={!createForm.name.trim() || create.isPending}
            >
              Add client
            </Button>
          </div>
        </div>
      )}

      {clients.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No clients yet"
          description="Add a client to attach projects, currencies, and invoice details."
          action={
            !creating && (
              <Button variant="primary" size="md" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" />
                New client
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {clients.map((client) => {
              const isEditing = editingId === client.id;
              return (
                <li
                  key={client.id}
                  className={
                    isEditing
                      ? 'px-3 py-3'
                      : 'group flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                  }
                >
                  {isEditing ? (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Edit client
                      </div>
                      <h2 className="mt-1 text-base font-semibold tracking-tight">{client.name}</h2>
                      <div className="mt-4">
                        <ClientFormFields
                          value={editForm}
                          onChange={setEditForm}
                          idPrefix={`client-edit-${client.id}`}
                        />
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-xs text-red-600">
                          {update.error ? (update.error as Error).message : ''}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={resetEditForm}>
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            size="md"
                            onClick={() => update.mutate()}
                            disabled={!editForm.name.trim() || update.isPending}
                          >
                            Save changes
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Avatar src={client.logo_data} name={client.name} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{client.name}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {client.email ?? 'no email'} · {client.currency}
                        </div>
                        {client.website && (
                          <div className="truncate text-xs text-zinc-400 dark:text-zinc-500">
                            <a
                              href={client.website}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                            >
                              {client.website}
                            </a>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => openEditForm(client)}
                      >
                        Edit
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

interface ClientFormFieldsProps {
  value: ClientFormState;
  onChange: (next: ClientFormState) => void;
  idPrefix: string;
}

function ClientFormFields({ value, onChange, idPrefix }: ClientFormFieldsProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [encoding, setEncoding] = useState(false);

  function patch(patch: Partial<ClientFormState>) {
    onChange({ ...value, ...patch });
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLogoError(null);
    setEncoding(true);
    try {
      const result = await encodeLogo(file);
      if ('error' in result) {
        setLogoError(result.error);
        return;
      }
      patch({ logoData: result.dataUrl });
    } finally {
      setEncoding(false);
    }
  }

  function clearLogo() {
    setLogoError(null);
    patch({ logoData: null });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)]">
      <div className="flex flex-col items-start gap-2">
        <FieldLabel>Logo</FieldLabel>
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950/40">
          {value.logoData ? (
            <img
              src={value.logoData}
              alt="Logo preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <Avatar name={value.name || '?'} size={64} rounded="md" />
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleFile}
        />
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={encoding}
          >
            {encoding ? 'Encoding…' : value.logoData ? 'Replace' : 'Upload'}
          </Button>
          {value.logoData && (
            <Button variant="ghost" size="sm" onClick={clearLogo} disabled={encoding}>
              Remove
            </Button>
          )}
        </div>
        {logoError && (
          <p className="text-xs text-red-600">{logoError}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
          <Input
            id={`${idPrefix}-name`}
            placeholder="Acme Inc."
            value={value.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-email`}>Email</FieldLabel>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            placeholder="billing@acme.com"
            value={value.email}
            onChange={(e) => patch({ email: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-website`}>Website</FieldLabel>
          <Input
            id={`${idPrefix}-website`}
            type="url"
            placeholder="https://acme.example"
            value={value.website}
            onChange={(e) => patch({ website: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-phone`}>Phone</FieldLabel>
          <Input
            id={`${idPrefix}-phone`}
            type="tel"
            placeholder="+1 555 123 4567"
            value={value.phone}
            onChange={(e) => patch({ phone: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-tax`}>Tax ID</FieldLabel>
          <Input
            id={`${idPrefix}-tax`}
            placeholder="EU123456789"
            value={value.taxId}
            onChange={(e) => patch({ taxId: e.target.value })}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`${idPrefix}-address`}>Address</FieldLabel>
          <Textarea
            id={`${idPrefix}-address`}
            rows={2}
            placeholder={'123 Market St\nSan Francisco, CA'}
            value={value.address}
            onChange={(e) => patch({ address: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-rate`}>Default hourly rate</FieldLabel>
          <Input
            id={`${idPrefix}-rate`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="125.00"
            value={value.hourlyRate}
            onChange={(e) => patch({ hourlyRate: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel>Currency</FieldLabel>
          <Combobox
            value={value.currency}
            onChange={(currency) => patch({ currency })}
            options={currencyOptions}
            placeholder="Currency"
            allowClear={false}
            searchPlaceholder="Find currency…"
          />
        </Field>
      </div>
    </div>
  );
}
