import { notFound } from 'next/navigation';
import Home from '../../page';

export default async function RabPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  if (slug.length > 2 || (slug.length === 2 && slug[1] !== 'edit')) notFound();
  return Home();
}
