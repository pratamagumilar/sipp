export function hasUnsavedChanges(current: { title: string; description: string; cost: string; file: File | null }, original: { title: string; description: string; cost: string }) {
  return current.title !== original.title || current.description !== original.description || current.cost !== original.cost || current.file !== null;
}
