import { notFound } from 'next/navigation';
import Home from '../../page';

export default async function PengajuanPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  if (slug.length > 2 || (slug.length === 2 && slug[1] !== 'edit' && !(slug[0] === 'id' && slug[1] === 'baru'))) notFound();
  return Home();
}
