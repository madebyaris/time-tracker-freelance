import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Button,
  Combobox,
  EmptyState,
  Field,
  FieldLabel,
  Input,
} from '@ttf/ui';
import { BriefcaseBusiness, Plus } from 'lucide-react';
import { Clients } from '../db/repos';
import { staticQueryOptions } from '../lib/query-client';

const currencies = ['USD', 'EUR', 'GBP', 'IDR', 'JPY', 'CAD', 'AUD'];
const currencyOptions = currencies.map((c) => ({ value: c, label: c }));

export function ClientsView() {
  const qc = useQueryClient();
  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: () => Clients.list(),
    ...staticQueryOptions,
  });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState<string | null>('USD');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCurrency, setEditCurrency] = useState<string | null>('USD');

  const create = useMutation({
    mutationFn: () =>
      Clients.create({
        name: name.trim(),
        email: email.trim() || null,
        currency: currency ?? 'USD',
      }),
    onSuccess: () => {
      resetCreateForm();
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
  const update = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error('Select a client to edit');
      return Clients.update(editingId, {
        name: editName.trim(),
        email: editEmail.trim() || null,
        currency: editCurrency ?? 'USD',
      });
    },
    onSuccess: () => {
      resetEditForm();
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const clients = clientsQ.data ?? [];

  function resetCreateForm() {
    create.reset();
    setName('');
    setEmail('');
    setCurrency('USD');
    setCreating(false);
  }

  function resetEditForm() {
    update.reset();
    setEditingId(null);
    setEditName('');
    setEditEmail('');
    setEditCurrency('USD');
  }

  function openEditForm(client: (typeof clients)[number]) {
    resetCreateForm();
    setEditName(client.name);
    setEditEmail(client.email ?? '');
    setEditCurrency(client.currency);
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
          <ClientFormFields
            name={name}
            onNameChange={setName}
            email={email}
            onEmailChange={setEmail}
            currency={currency}
            onCurrencyChange={setCurrency}
          />
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={resetCreateForm}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => create.mutate()}
              disabled={!name.trim() || create.isPending}
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
                          name={editName}
                          onNameChange={setEditName}
                          email={editEmail}
                          onEmailChange={setEditEmail}
                          currency={editCurrency}
                          onCurrencyChange={setEditCurrency}
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
                            disabled={!editName.trim() || update.isPending}
                          >
                            Save changes
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {client.name.slice(0, 2)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{client.name}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {client.email ?? 'no email'} · {client.currency}
                        </div>
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

function ClientFormFields({
  name,
  onNameChange,
  email,
  onEmailChange,
  currency,
  onCurrencyChange,
}: {
  name: string;
  onNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  currency: string | null;
  onCurrencyChange: (value: string | null) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="client-name">Name</FieldLabel>
        <Input
          id="client-name"
          placeholder="Acme Inc."
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="client-email">Email</FieldLabel>
        <Input
          id="client-email"
          type="email"
          placeholder="billing@acme.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel>Currency</FieldLabel>
        <Combobox
          value={currency}
          onChange={onCurrencyChange}
          options={currencyOptions}
          placeholder="Currency"
          allowClear={false}
          searchPlaceholder="Find currency…"
        />
      </Field>
    </div>
  );
}
