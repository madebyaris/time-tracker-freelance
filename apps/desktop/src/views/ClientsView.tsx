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

  const create = useMutation({
    mutationFn: () =>
      Clients.create({
        name,
        email: email || null,
        currency: currency ?? 'USD',
      }),
    onSuccess: () => {
      setName('');
      setEmail('');
      setCreating(false);
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const clients = clientsQ.data ?? [];

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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="client-name">Name</FieldLabel>
              <Input
                id="client-name"
                autoFocus
                placeholder="Acme Inc."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="client-email">Email</FieldLabel>
              <Input
                id="client-email"
                type="email"
                placeholder="billing@acme.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Currency</FieldLabel>
              <Combobox
                value={currency}
                onChange={setCurrency}
                options={currencyOptions}
                placeholder="Currency"
                allowClear={false}
                searchPlaceholder="Find currency…"
              />
            </Field>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => create.mutate()}
              disabled={!name || create.isPending}
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
            {clients.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {c.name.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {c.email ?? 'no email'} · {c.currency}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
