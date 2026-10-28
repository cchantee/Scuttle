import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { newId } from '../domain/models';
import { CollectionName } from '../domain/store';
import { useData } from '../state/DataProvider';

export function useCrud(collection: CollectionName) {
  const { data, saveRecord, deleteRecord } = useData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const saving = useRef(false);
  const list = data[collection] as any[];
  const confirmDelete = (id: string) => Alert.alert('Delete record?', 'This action cannot be undone. If another record depends on this one, deletion will be blocked with an explanation.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void deleteRecord(collection, id); } },
  ]);
  const submit = async (fields: any) => {
    if (saving.current) return false;
    saving.current = true;
    try {
      const ok = await saveRecord(collection, { ...fields, id: editingId ?? newId() });
      if (ok) setEditingId(null);
      return ok;
    } finally { saving.current = false; }
  };
  const edit = (item: any, fill: (item: any) => void) => { setEditingId(item.id); fill(item); };
  const cancel = () => setEditingId(null);
  return { list, editingId, setEditingId, confirmDelete, submit, edit, cancel };
}
