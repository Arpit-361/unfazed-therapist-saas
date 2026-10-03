import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../common/Modal';
import Button from '../common/Button';
import TagInput from '../common/TagInput';
import { Field, Input } from '../common/Field';
import { clientsApi } from '../../api/endpoints';

export default function AddClientModal({ open, onClose, onCreated }) {
  const [tags, setTags] = useState([]);
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm();

  const close = () => {
    reset();
    setTags([]);
    onClose();
  };

  const onSubmit = async (values) => {
    try {
      const res = await clientsApi.create({ ...values, tags });
      reset();
      setTags([]);
      onCreated(res);
    } catch (err) {
      if (err.code !== 'UPGRADE_REQUIRED') setError('root', { message: err.message });
      else close();
    }
  };

  return (
    <Modal open={open} onClose={close} title="Add a client" description="They'll receive an invitation to their secure portal.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {errors.root && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.root.message}</div>}
        <Field label="Full name" error={errors.name?.message} required>
          <Input {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" error={errors.email?.message} required>
            <Input type="email" {...register('email', { required: 'Email is required' })} />
          </Field>
          <Field label="Phone">
            <Input placeholder="+91" {...register('phone')} />
          </Field>
        </div>
        <Field label="Tags" hint="e.g. anxiety, couples, sliding-scale">
          <TagInput value={tags} onChange={setTags} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Add & invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}
