'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  updateBusinessProfile,
  type ProfileFormState,
} from './actions';

const initial: ProfileFormState = {};

const ENTITY_TYPES = [
  { value: 'sole_prop', label: 'Sole proprietorship' },
  { value: 'llc', label: 'LLC' },
  { value: 's_corp', label: 'S-Corp' },
  { value: 'c_corp', label: 'C-Corp' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'other', label: 'Other' },
] as const;

const NONE = 'none';

export type Profile = {
  legalName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  entityType: string | null;
  einMasked: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save profile'}
    </Button>
  );
}

export function ProfileForm({
  bizId,
  profile,
}: {
  bizId: string;
  profile: Profile;
}) {
  const [state, formAction] = useActionState(updateBusinessProfile, initial);
  const initialEntity = profile.entityType ?? NONE;

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success('Profile saved.');
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="bizId" value={bizId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="legalName">Legal name</Label>
          <Input
            id="legalName"
            name="legalName"
            required
            maxLength={200}
            defaultValue={profile.legalName}
          />
          <p className="text-xs text-muted-foreground">
            Exactly as registered with the IRS or state.
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="displayName">Display name (DBA)</Label>
          <Input
            id="displayName"
            name="displayName"
            maxLength={200}
            defaultValue={profile.displayName ?? ''}
            placeholder="What customers see"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Contact email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            maxLength={200}
            defaultValue={profile.email ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            maxLength={50}
            defaultValue={profile.phone ?? ''}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Address</Label>
        <Input
          name="addressLine1"
          maxLength={200}
          placeholder="Street address"
          defaultValue={profile.addressLine1 ?? ''}
        />
        <Input
          name="addressLine2"
          maxLength={200}
          placeholder="Apt / Suite (optional)"
          defaultValue={profile.addressLine2 ?? ''}
        />
        <div className="grid grid-cols-3 gap-2">
          <Input
            name="city"
            maxLength={100}
            placeholder="City"
            defaultValue={profile.city ?? ''}
          />
          <Input
            name="state"
            maxLength={50}
            placeholder="State"
            defaultValue={profile.state ?? ''}
          />
          <Input
            name="postalCode"
            maxLength={20}
            placeholder="ZIP"
            defaultValue={profile.postalCode ?? ''}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="entityType-select">Entity type</Label>
          <Select name="entityType" defaultValue={initialEntity}>
            <SelectTrigger id="entityType-select">
              <SelectValue placeholder="Pick a type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {ENTITY_TYPES.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ein">EIN</Label>
          <Input
            id="ein"
            name="ein"
            maxLength={10}
            placeholder={profile.einMasked ?? 'NN-NNNNNNN'}
          />
          <p className="text-xs text-muted-foreground">
            {profile.einMasked
              ? 'Leave blank to keep the existing value.'
              : 'Encrypted at rest. Used on tax exports.'}
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
