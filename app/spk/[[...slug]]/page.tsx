import { notFound } from 'next/navigation';
import Home from '../../page';
import { spkRoute } from '../../navigation';

export default async function SpkPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  if (slug.length > 1 || (slug.length === 1 && (!slug[0] || !spkRoute('/spk/' + encodeURIComponent(slug[0]))))) notFound();
  return Home();
}
