import { useState } from 'react';
import { BookOpen, Coffee, Cpu, Download, Hammer, Home, Layers, Sparkles } from 'lucide-react';
import type { ProductCategory } from '../../types/domain';

interface ProductImageProps {
  src?: string;
  alt: string;
  category: ProductCategory;
  className?: string;
}

export function ProductImage({ src, alt, category, className = 'h-12 w-12' }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`rounded border border-slate-200 object-cover bg-slate-100 shrink-0 ${className}`}
      />
    );
  }

  const Icon =
    category === 'Electronics'
      ? Cpu
      : category === 'Home & Kitchen'
      ? Home
      : category === 'Beauty & Personal Care'
      ? Sparkles
      : category === 'Books & Stationery'
      ? BookOpen
      : category === 'Specialty Groceries'
      ? Coffee
      : category === 'Digital Downloads'
      ? Download
      : category === 'Subscriptions & Bundles'
      ? Layers
      : Hammer;

  return (
    <div
      aria-label={alt}
      className={`rounded border border-slate-200 bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 ${className}`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </div>
  );
}
