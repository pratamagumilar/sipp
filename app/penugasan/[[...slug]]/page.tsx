import { notFound } from 'next/navigation';
import Home from '../../page';
import { assignmentRoute } from '../../navigation';

export default async function AssignmentPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  if (!assignmentRoute('/penugasan' + (slug.length ? '/' + slug.map(encodeURIComponent).join('/') : ''))) notFound();
  return Home();
}
